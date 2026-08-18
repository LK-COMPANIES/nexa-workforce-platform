import { Money, roundRate } from "./money";
import type {
  CalculationStep,
  KenyaPayrollRules,
  PayrollCalculationInput,
  PayrollCalculationResult,
} from "./types";
import { validatePayrollCalculationInput } from "./validate";

/**
 * Bumped whenever the calculation LOGIC changes (not on every package
 * version). Persisted onto every PayrollRecord (brief §38: reproducibility
 * requires knowing which engine version produced a number) — a schema-only
 * or comment-only change does not need a bump; a change to how any amount
 * is computed does.
 */
export const PAYROLL_ENGINE_VERSION = "1.0.0";

// -----------------------------------------------------------------------------
// Rounding-composition policy: every quantity that is BOTH (a) returned as
// its own named result field and (b) used as an input to a later sum is
// rounded to 2dp (via Money.rounded()) at the moment it is first computed,
// and every later formula is built from that already-rounded value. This
// guarantees a displayed total always equals the exact sum of the displayed
// line items it's built from — an auditor re-adding the payslip's own
// printed figures must reconstruct the printed total exactly, not land a
// cent off due to rounding full-precision sub-totals independently. Only
// genuinely internal-only intermediates (individual PAYE band amounts,
// which are never separately displayed/reconciled — a payslip shows one
// PAYE line, not five) use full Decimal precision throughout.
// -----------------------------------------------------------------------------

interface NssfCalculation {
  tier1Employee: Money;
  tier2Employee: Money;
  employeeTotal: Money;
  tier1Employer: Money;
  tier2Employer: Money;
  employerTotal: Money;
  steps: CalculationStep[];
}

function calculateNssf(pensionablePay: Money, rules: KenyaPayrollRules, ruleId?: string): NssfCalculation {
  const steps: CalculationStep[] = [];
  const tierAmounts: Record<"I" | "II", { employee: Money; employer: Money }> = {
    I: { employee: Money.zero(), employer: Money.zero() },
    II: { employee: Money.zero(), employer: Money.zero() },
  };

  for (const tier of rules.nssf.tiers) {
    const lowerLimit = Money.of(tier.lowerLimit);
    const upperLimit = Money.of(tier.upperLimit);
    const tierWidth = upperLimit.minus(lowerLimit);
    const payAboveLower = pensionablePay.minus(lowerLimit).clampToZero();
    const pensionableInTier = Money.min(payAboveLower, tierWidth);

    const employeeAmount = pensionableInTier.times(tier.employeeRate).rounded();
    const employerAmount = pensionableInTier.times(tier.employerRate).rounded();

    tierAmounts[tier.tier] = { employee: employeeAmount, employer: employerAmount };

    steps.push({
      type: `NSSF_TIER_${tier.tier}_EMPLOYEE`,
      base: pensionableInTier.toRoundedNumber(),
      rate: tier.employeeRate,
      amount: employeeAmount.toRoundedNumber(),
      statutoryRuleId: ruleId,
      description: `NSSF Tier ${tier.tier} employee contribution: ${(tier.employeeRate * 100).toFixed(2)}% of pensionable pay between ${tier.lowerLimit} and ${tier.upperLimit}`,
    });
    steps.push({
      type: `NSSF_TIER_${tier.tier}_EMPLOYER`,
      base: pensionableInTier.toRoundedNumber(),
      rate: tier.employerRate,
      amount: employerAmount.toRoundedNumber(),
      statutoryRuleId: ruleId,
      description: `NSSF Tier ${tier.tier} employer contribution: ${(tier.employerRate * 100).toFixed(2)}% of pensionable pay between ${tier.lowerLimit} and ${tier.upperLimit}`,
    });
  }

  return {
    tier1Employee: tierAmounts.I.employee,
    tier2Employee: tierAmounts.II.employee,
    // Sum of already-rounded tier amounts, so nssfEmployeeTotal always
    // exactly equals nssfTier1Employee + nssfTier2Employee as displayed.
    employeeTotal: tierAmounts.I.employee.plus(tierAmounts.II.employee),
    tier1Employer: tierAmounts.I.employer,
    tier2Employer: tierAmounts.II.employer,
    employerTotal: tierAmounts.I.employer.plus(tierAmounts.II.employer),
    steps,
  };
}

interface ShifCalculation {
  employee: Money;
  base: Money;
  steps: CalculationStep[];
}

function calculateShif(base: Money, rules: KenyaPayrollRules, ruleId?: string): ShifCalculation {
  let amount = base.times(rules.shif.rate).rounded();
  if (rules.shif.minimumMonthlyContribution !== null) {
    amount = Money.max(amount, Money.of(rules.shif.minimumMonthlyContribution).rounded());
  }
  if (rules.shif.cap !== null) {
    amount = Money.min(amount, Money.of(rules.shif.cap).rounded());
  }

  return {
    employee: amount,
    base,
    steps: [
      {
        type: "SHIF_EMPLOYEE",
        base: base.toRoundedNumber(),
        rate: rules.shif.rate,
        amount: amount.toRoundedNumber(),
        statutoryRuleId: ruleId,
        description: `SHIF: ${(rules.shif.rate * 100).toFixed(2)}% of applicable gross pay`,
      },
    ],
  };
}

interface HousingLevyCalculation {
  employee: Money;
  employer: Money;
  steps: CalculationStep[];
}

function calculateHousingLevy(base: Money, rules: KenyaPayrollRules, ruleId?: string): HousingLevyCalculation {
  let employee = base.times(rules.housingLevy.employeeRate).rounded();
  let employer = base.times(rules.housingLevy.employerRate).rounded();
  if (rules.housingLevy.cap !== null) {
    const cap = Money.of(rules.housingLevy.cap).rounded();
    employee = Money.min(employee, cap);
    employer = Money.min(employer, cap);
  }

  return {
    employee,
    employer,
    steps: [
      {
        type: "HOUSING_LEVY_EMPLOYEE",
        base: base.toRoundedNumber(),
        rate: rules.housingLevy.employeeRate,
        amount: employee.toRoundedNumber(),
        statutoryRuleId: ruleId,
        description: `Affordable Housing Levy: ${(rules.housingLevy.employeeRate * 100).toFixed(2)}% employee contribution on gross monthly salary`,
      },
      {
        type: "HOUSING_LEVY_EMPLOYER",
        base: base.toRoundedNumber(),
        rate: rules.housingLevy.employerRate,
        amount: employer.toRoundedNumber(),
        statutoryRuleId: ruleId,
        description: `Affordable Housing Levy: ${(rules.housingLevy.employerRate * 100).toFixed(2)}% employer contribution on gross monthly salary`,
      },
    ],
  };
}

interface PayeCalculation {
  taxBeforeRelief: Money;
  steps: CalculationStep[];
}

/**
 * Progressive PAYE: each band's marginal rate applies ONLY to the slice of
 * taxablePay that falls within it — never the full salary at the highest
 * marginal rate. A band's effective lower bound is the PREVIOUS band's
 * `monthlyTo` (starting at 0), not its own `monthlyFrom` — the seeded data's
 * `monthlyFrom` values carry a "+0.01" display convention (e.g. the second
 * band starts at 24000.01) that exists for human-readable documentation,
 * not for this arithmetic; deriving width from the running upper bound
 * avoids relying on that convention. Individual bands are never separately
 * displayed on a payslip, so band math stays at full precision throughout —
 * only the final summed total is rounded once.
 */
function calculateProgressivePaye(taxablePay: Money, rules: KenyaPayrollRules, ruleId?: string): PayeCalculation {
  const steps: CalculationStep[] = [];
  let taxBeforeRelief = Money.zero();
  let lowerBound = Money.zero();

  for (const band of rules.paye.bands) {
    if (!taxablePay.greaterThan(lowerBound)) {
      break;
    }
    const upperBound = band.monthlyTo === null ? null : Money.of(band.monthlyTo);
    const amountInBand = (upperBound === null ? taxablePay : Money.min(taxablePay, upperBound))
      .minus(lowerBound)
      .clampToZero();

    if (!amountInBand.isZero()) {
      const bandTax = amountInBand.times(band.rate);
      taxBeforeRelief = taxBeforeRelief.plus(bandTax);
      steps.push({
        type: "PAYE_BAND",
        base: amountInBand.toRoundedNumber(),
        rate: band.rate,
        amount: bandTax.toRoundedNumber(),
        statutoryRuleId: ruleId,
        description: `PAYE at ${(band.rate * 100).toFixed(2)}% on ${amountInBand.toRoundedNumber()} (band up to ${band.monthlyTo ?? "unbounded"})`,
      });
    }

    if (upperBound === null) {
      break;
    }
    lowerBound = upperBound;
  }

  return { taxBeforeRelief: taxBeforeRelief.rounded(), steps };
}

export function calculateKenyaPayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  validatePayrollCalculationInput(input);

  const rules = input.rules;
  const steps: CalculationStep[] = [];

  const cashPay = Money.of(input.cashGrossPay).rounded();
  const nonCashBenefitsTotal = Money.sum(input.nonCashBenefits.map((b) => Money.of(b.amount).rounded()));
  const taxableBenefitsTotal = Money.sum(
    input.nonCashBenefits.filter((b) => b.taxable).map((b) => Money.of(b.amount).rounded()),
  );

  const grossPay = cashPay.plus(nonCashBenefitsTotal);
  const totalEmploymentIncome = cashPay.plus(taxableBenefitsTotal);

  // Statutory contributions are computed on cash pay (pensionable/applicable
  // gross pay) — non-cash benefits are not a cash contribution base. This is
  // a documented simplification; a more sophisticated pensionable-pay
  // definition (excluding specific cash allowances) is a future extension,
  // not a Phase 3 requirement.
  const nssf = calculateNssf(cashPay, rules, rules.ruleVersionIds?.nssf);
  const shif = calculateShif(cashPay, rules, rules.ruleVersionIds?.shif);
  const housingLevy = calculateHousingLevy(cashPay, rules, rules.ruleVersionIds?.housingLevy);
  steps.push(...nssf.steps, ...shif.steps, ...housingLevy.steps);

  // NSSF, SHIF, and the employee Housing Levy are themselves allowable
  // deductions for PAYE purposes under current KRA guidance — they reduce
  // taxable pay before progressive tax is applied, in addition to any
  // explicit allowableDeductions supplied with PRE_TAX treatment (e.g.
  // approved pension contributions, mortgage interest).
  const explicitPreTaxDeductions = Money.sum(
    input.allowableDeductions
      .filter((d) => d.taxTreatment === "PRE_TAX")
      .map((d) => Money.of(d.amount).rounded()),
  );
  const preTaxDeductions = nssf.employeeTotal
    .plus(shif.employee)
    .plus(housingLevy.employee)
    .plus(explicitPreTaxDeductions);

  const taxablePay = totalEmploymentIncome.minus(preTaxDeductions).clampToZero();

  const { taxBeforeRelief: payeBeforeRelief, steps: payeSteps } = calculateProgressivePaye(
    taxablePay,
    rules,
    rules.ruleVersionIds?.paye,
  );
  steps.push(...payeSteps);

  const personalRelief = Money.of(rules.paye.personalReliefMonthly).rounded();
  const otherReliefs = Money.zero(); // extension point: insurance relief, disability relief, etc.
  // PAYE must never be negative — relief exceeding tax due simply zeroes PAYE.
  const paye = payeBeforeRelief.minus(personalRelief).minus(otherReliefs).clampToZero();
  steps.push({
    type: "PERSONAL_RELIEF",
    base: payeBeforeRelief.toRoundedNumber(),
    rate: null,
    amount: personalRelief.toRoundedNumber(),
    statutoryRuleId: rules.ruleVersionIds?.paye,
    description: "Monthly personal relief applied against tax before relief",
  });

  const allowableDeductionsTotal = Money.sum(input.allowableDeductions.map((d) => Money.of(d.amount).rounded()));
  const otherDeductionsTotal = Money.sum(input.otherDeductions.map((d) => Money.of(d.amount).rounded()));

  const explicitEmployeeImpactDeductions = Money.sum(
    input.allowableDeductions.filter((d) => d.employeeImpact).map((d) => Money.of(d.amount).rounded()),
  );
  const totalEmployeeDeductions = paye
    .plus(nssf.employeeTotal)
    .plus(shif.employee)
    .plus(housingLevy.employee)
    .plus(explicitEmployeeImpactDeductions)
    .plus(otherDeductionsTotal);

  // netPay is derived from CASH pay only — an employee cannot spend an
  // untaxed car benefit, but they do pay PAYE on it via their cash salary
  // (brief §37: netPay = grossCashPay - employeeDeductions).
  const netPay = cashPay.minus(totalEmployeeDeductions);
  if (netPay.isNegative()) {
    throw new RangeError(
      `Calculated netPay is negative (${netPay.toRoundedNumber()}) for employee ${input.employeeId} — ` +
        "employee deductions exceed cash pay. This must be resolved before persisting a payroll record; " +
        "the engine deliberately does not clamp this to zero, since silently absorbing the shortfall would " +
        "misstate the employee's actual deductions.",
    );
  }

  const explicitEmployerImpactDeductions = Money.sum(
    input.allowableDeductions.filter((d) => d.employerImpact).map((d) => Money.of(d.amount).rounded()),
  );
  const employerStatutoryCost = nssf.employerTotal.plus(housingLevy.employer).plus(explicitEmployerImpactDeductions);
  const totalEmploymentCost = grossPay.plus(employerStatutoryCost);

  const effectiveTaxRate = totalEmploymentIncome.isZero()
    ? 0
    : roundRate(paye.raw().dividedBy(totalEmploymentIncome.raw()));

  return {
    employeeId: input.employeeId,
    currency: input.currency,

    grossPay: grossPay.toRoundedNumber(),
    cashPay: cashPay.toRoundedNumber(),
    nonCashBenefits: nonCashBenefitsTotal.toRoundedNumber(),
    taxableBenefits: taxableBenefitsTotal.toRoundedNumber(),
    totalEmploymentIncome: totalEmploymentIncome.toRoundedNumber(),
    preTaxDeductions: preTaxDeductions.toRoundedNumber(),
    taxablePay: taxablePay.toRoundedNumber(),

    nssfTier1Employee: nssf.tier1Employee.toRoundedNumber(),
    nssfTier2Employee: nssf.tier2Employee.toRoundedNumber(),
    nssfEmployeeTotal: nssf.employeeTotal.toRoundedNumber(),
    nssfTier1Employer: nssf.tier1Employer.toRoundedNumber(),
    nssfTier2Employer: nssf.tier2Employer.toRoundedNumber(),
    nssfEmployerTotal: nssf.employerTotal.toRoundedNumber(),

    shifEmployee: shif.employee.toRoundedNumber(),
    shifCalculationBase: shif.base.toRoundedNumber(),

    housingLevyEmployee: housingLevy.employee.toRoundedNumber(),
    housingLevyEmployer: housingLevy.employer.toRoundedNumber(),

    allowableDeductionsTotal: allowableDeductionsTotal.toRoundedNumber(),
    otherDeductionsTotal: otherDeductionsTotal.toRoundedNumber(),

    payeBeforeRelief: payeBeforeRelief.toRoundedNumber(),
    personalRelief: personalRelief.toRoundedNumber(),
    otherReliefs: otherReliefs.toRoundedNumber(),
    paye: paye.toRoundedNumber(),

    totalEmployeeDeductions: totalEmployeeDeductions.toRoundedNumber(),
    employerStatutoryCost: employerStatutoryCost.toRoundedNumber(),
    netPay: netPay.toRoundedNumber(),
    totalEmploymentCost: totalEmploymentCost.toRoundedNumber(),
    effectiveTaxRate,

    calculationSteps: steps,
    engineVersion: PAYROLL_ENGINE_VERSION,
  };
}
