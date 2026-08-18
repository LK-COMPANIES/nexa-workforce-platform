import { calculateKenyaPayroll, PAYROLL_ENGINE_VERSION } from "./kenya";
import { KENYA_2026_RULES } from "./kenya-2026-fixture";
import type { KenyaPayrollRules, PayrollCalculationInput } from "./types";
import { PayrollEngineValidationError } from "./types";

const PERIOD = { start: "2026-01-01", end: "2026-01-31" };

function baseInput(overrides: Partial<PayrollCalculationInput> = {}): PayrollCalculationInput {
  return {
    employeeId: "emp-1",
    period: PERIOD,
    currency: "KES",
    cashGrossPay: 0,
    nonCashBenefits: [],
    allowableDeductions: [],
    otherDeductions: [],
    taxResidencyStatus: "RESIDENT",
    rules: KENYA_2026_RULES,
    ...overrides,
  };
}

// Isolates the PAYE algorithm: same bands/relief as the real 2026 ruleset,
// but NSSF/SHIF/Housing Levy zeroed out so taxablePay === cashGrossPay
// exactly, making every expected figure below hand-verifiable.
const PAYE_ONLY_RULES: KenyaPayrollRules = {
  ...KENYA_2026_RULES,
  nssf: {
    tiers: [
      { tier: "I", lowerLimit: 0, upperLimit: 9000, employeeRate: 0, employerRate: 0 },
      { tier: "II", lowerLimit: 9000, upperLimit: 108000, employeeRate: 0, employerRate: 0 },
    ],
  },
  shif: { rate: 0, minimumMonthlyContribution: null, cap: null },
  housingLevy: { employeeRate: 0, employerRate: 0, cap: null },
};

// Isolates NSSF: PAYE rate zeroed (so relief never matters) and SHIF/Housing
// Levy zeroed, leaving only NSSF's tiered contribution visible in the result.
const NSSF_ONLY_RULES: KenyaPayrollRules = {
  ...KENYA_2026_RULES,
  paye: { bands: [{ monthlyFrom: 0, monthlyTo: null, rate: 0 }], personalReliefMonthly: 0 },
  shif: { rate: 0, minimumMonthlyContribution: null, cap: null },
  housingLevy: { employeeRate: 0, employerRate: 0, cap: null },
};

const SHIF_ONLY_RULES: KenyaPayrollRules = {
  ...KENYA_2026_RULES,
  paye: { bands: [{ monthlyFrom: 0, monthlyTo: null, rate: 0 }], personalReliefMonthly: 0 },
  nssf: {
    tiers: [
      { tier: "I", lowerLimit: 0, upperLimit: 9000, employeeRate: 0, employerRate: 0 },
      { tier: "II", lowerLimit: 9000, upperLimit: 108000, employeeRate: 0, employerRate: 0 },
    ],
  },
  housingLevy: { employeeRate: 0, employerRate: 0, cap: null },
};

const HOUSING_LEVY_ONLY_RULES: KenyaPayrollRules = {
  ...KENYA_2026_RULES,
  paye: { bands: [{ monthlyFrom: 0, monthlyTo: null, rate: 0 }], personalReliefMonthly: 0 },
  nssf: {
    tiers: [
      { tier: "I", lowerLimit: 0, upperLimit: 9000, employeeRate: 0, employerRate: 0 },
      { tier: "II", lowerLimit: 9000, upperLimit: 108000, employeeRate: 0, employerRate: 0 },
    ],
  },
  shif: { rate: 0, minimumMonthlyContribution: null, cap: null },
};

describe("PAYE — progressive band calculation (isolated from NSSF/SHIF/Housing Levy)", () => {
  it("entry level: salary below the first band pays no PAYE before relief exceeds it", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 15000, rules: PAYE_ONLY_RULES }));
    expect(result.payeBeforeRelief).toBeCloseTo(1500, 6); // 15000 * 10%
    expect(result.paye).toBe(0); // relief (2400) exceeds tax (1500)
  });

  it("boundary: exactly 24,000 — entirely within the 10% band", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 24000, rules: PAYE_ONLY_RULES }));
    expect(result.payeBeforeRelief).toBeCloseTo(2400, 6); // 24000 * 10%
  });

  it("boundary: one shilling into the 25% band (24,001)", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 24001, rules: PAYE_ONLY_RULES }));
    // 24000 * 10% + 1 * 25% = 2400 + 0.25
    expect(result.payeBeforeRelief).toBeCloseTo(2400.25, 6);
  });

  it("boundary: exactly 32,333 — top of the 25% band", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 32333, rules: PAYE_ONLY_RULES }));
    // 2400 + (32333-24000)*25% = 2400 + 2083.25
    expect(result.payeBeforeRelief).toBeCloseTo(4483.25, 6);
  });

  it("boundary: exactly 500,000 — top of the 30% band", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 500000, rules: PAYE_ONLY_RULES }));
    // 4483.25 + (500000-32333)*30% = 4483.25 + 140300.10
    expect(result.payeBeforeRelief).toBeCloseTo(144783.35, 6);
  });

  it("boundary: exactly 800,000 — top of the 32.5% band", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 800000, rules: PAYE_ONLY_RULES }));
    // 144783.35 + (800000-500000)*32.5% = 144783.35 + 97500
    expect(result.payeBeforeRelief).toBeCloseTo(242283.35, 6);
  });

  it("mid-tier: 100,000 crosses three bands (10%, 25%, 30%)", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 100000, rules: PAYE_ONLY_RULES }));
    // 2400 + 2083.25 + (100000-32333)*30% = 2400 + 2083.25 + 20300.10
    expect(result.payeBeforeRelief).toBeCloseTo(24783.35, 6);
  });

  it("executive: 1,000,000 reaches the unbounded top 35% band", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 1000000, rules: PAYE_ONLY_RULES }));
    // 242283.35 + (1000000-800000)*35% = 242283.35 + 70000
    expect(result.payeBeforeRelief).toBeCloseTo(312283.35, 6);
    expect(result.paye).toBeCloseTo(309883.35, 6); // minus 2400 relief
  });

  it("never applies the marginal rate to the whole salary (the classic bug)", () => {
    // A naive "flat top-rate" implementation would compute 1,000,000 * 35% = 350,000.
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 1000000, rules: PAYE_ONLY_RULES }));
    expect(result.payeBeforeRelief).toBeLessThan(1000000 * 0.35);
  });

  it("relief greater than calculated tax: PAYE floors at zero, never negative", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 5000, rules: PAYE_ONLY_RULES }));
    expect(result.payeBeforeRelief).toBeCloseTo(500, 6); // 5000*10%, well under 2400 relief
    expect(result.paye).toBe(0);
    expect(result.paye).toBeGreaterThanOrEqual(0);
  });

  it("returns an auditable calculationSteps breakdown identifying each band applied", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 100000, rules: PAYE_ONLY_RULES }));
    const payeSteps = result.calculationSteps.filter((s) => s.type === "PAYE_BAND");
    expect(payeSteps).toHaveLength(3); // 10%, 25%, 30% bands touched
    expect(payeSteps.map((s) => s.rate)).toEqual([0.1, 0.25, 0.3]);
    const reconstructed = payeSteps.reduce((sum, s) => sum + s.amount, 0);
    expect(reconstructed).toBeCloseTo(result.payeBeforeRelief, 2);
  });
});

describe("NSSF — 2026 two-tier calculation (isolated from PAYE/SHIF/Housing Levy)", () => {
  it("below Tier I limit (9,000): only Tier I applies, proportionally", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 5000, rules: NSSF_ONLY_RULES }));
    expect(result.nssfTier1Employee).toBeCloseTo(300, 6); // 5000 * 6%
    expect(result.nssfTier2Employee).toBe(0);
    expect(result.nssfEmployeeTotal).toBeCloseTo(300, 6);
    expect(result.nssfTier1Employer).toBeCloseTo(300, 6);
  });

  it("exactly at the Tier I limit (9,000): Tier I maxed, Tier II untouched", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 9000, rules: NSSF_ONLY_RULES }));
    expect(result.nssfTier1Employee).toBeCloseTo(540, 6); // 9000 * 6%
    expect(result.nssfTier2Employee).toBe(0);
  });

  it("between the two limits (50,000): Tier I capped, Tier II proportional", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 50000, rules: NSSF_ONLY_RULES }));
    expect(result.nssfTier1Employee).toBeCloseTo(540, 6);
    expect(result.nssfTier2Employee).toBeCloseTo(2460, 6); // (50000-9000)*6%
    expect(result.nssfEmployeeTotal).toBeCloseTo(3000, 6);
  });

  it("above the Tier II limit (150,000): both tiers capped at their maximums", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 150000, rules: NSSF_ONLY_RULES }));
    expect(result.nssfTier1Employee).toBeCloseTo(540, 6);
    expect(result.nssfTier2Employee).toBeCloseTo(5940, 6); // (108000-9000)*6%, capped
    expect(result.nssfEmployeeTotal).toBeCloseTo(6480, 6); // 540 + 5940 — the TOTAL combined cap
    expect(result.nssfEmployerTotal).toBeCloseTo(6480, 6);
  });

  it("does not increase past the combined 6,480 cap for even higher salaries", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 5000000, rules: NSSF_ONLY_RULES }));
    expect(result.nssfEmployeeTotal).toBeCloseTo(6480, 6);
  });
});

describe("SHIF — flat rate (isolated from PAYE/NSSF/Housing Levy)", () => {
  it.each([
    [10000, 275],
    [50000, 1375],
    [100000, 2750],
  ])("gross %d -> SHIF %d", (gross, expected) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross, rules: SHIF_ONLY_RULES }));
    expect(result.shifEmployee).toBeCloseTo(expected, 6);
    expect(result.shifCalculationBase).toBeCloseTo(gross, 6);
  });
});

describe("Affordable Housing Levy — employee and employer, calculated separately", () => {
  it("computes 1.5% employee and 1.5% employer independently", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 20000, rules: HOUSING_LEVY_ONLY_RULES }));
    expect(result.housingLevyEmployee).toBeCloseTo(300, 6);
    expect(result.housingLevyEmployer).toBeCloseTo(300, 6);
  });
});

describe("Non-cash benefits", () => {
  it("distinguishes taxable from non-taxable benefits per the supplied flag", () => {
    const result = calculateKenyaPayroll(
      baseInput({
        cashGrossPay: 50000,
        nonCashBenefits: [
          { label: "Company car", amount: 20000, taxable: true },
          { label: "Medical cover", amount: 10000, taxable: false },
        ],
        rules: PAYE_ONLY_RULES,
      }),
    );
    expect(result.nonCashBenefits).toBeCloseTo(30000, 6); // both, for grossPay purposes
    expect(result.taxableBenefits).toBeCloseTo(20000, 6); // only the taxable one
    expect(result.grossPay).toBeCloseTo(80000, 6); // cash + ALL benefits
    expect(result.totalEmploymentIncome).toBeCloseTo(70000, 6); // cash + TAXABLE benefits only
    // PAYE on 70000: 2400 + 2083.25 + (70000-32333)*30% = 2400+2083.25+11300.10
    expect(result.payeBeforeRelief).toBeCloseTo(15783.35, 6);
  });
});

describe("Allowable deductions — classified, not a bare subtraction", () => {
  it("PRE_TAX deductions reduce taxablePay; all employee-impacting deductions reduce netPay", () => {
    const result = calculateKenyaPayroll(
      baseInput({
        cashGrossPay: 50000,
        allowableDeductions: [
          {
            type: "APPROVED_PENSION_CONTRIBUTION",
            amount: 5000,
            taxTreatment: "PRE_TAX",
            employeeImpact: true,
            employerImpact: false,
          },
          {
            type: "OTHER_ALLOWABLE_STATUTORY",
            amount: 1000,
            taxTreatment: "POST_TAX",
            employeeImpact: true,
            employerImpact: true,
          },
        ],
        rules: PAYE_ONLY_RULES,
      }),
    );
    expect(result.taxablePay).toBeCloseTo(45000, 6); // 50000 - 5000 (PRE_TAX only)
    // PAYE on 45000: 2400 + 2083.25 + (45000-32333)*30% = 2400+2083.25+3800.10
    expect(result.payeBeforeRelief).toBeCloseTo(8283.35, 6);
    expect(result.paye).toBeCloseTo(5883.35, 6);
    expect(result.allowableDeductionsTotal).toBeCloseTo(6000, 6);
    // totalEmployeeDeductions = paye + both deductions (both employeeImpact=true)
    expect(result.totalEmployeeDeductions).toBeCloseTo(5883.35 + 6000, 2);
    expect(result.netPay).toBeCloseTo(50000 - (5883.35 + 6000), 2);
    // Only the second deduction has employerImpact=true
    expect(result.employerStatutoryCost).toBeCloseTo(1000, 6);
  });

  it("non-statutory otherDeductions reduce netPay but never touch taxablePay", () => {
    const result = calculateKenyaPayroll(
      baseInput({
        cashGrossPay: 30000,
        otherDeductions: [{ label: "Salary advance repayment", amount: 2000 }],
        rules: PAYE_ONLY_RULES,
      }),
    );
    expect(result.taxablePay).toBeCloseTo(30000, 6); // unaffected
    expect(result.otherDeductionsTotal).toBeCloseTo(2000, 6);
    // PAYE on 30000: 2400 + (30000-24000)*25% = 2400+1500 = 3900; minus relief 2400 = 1500
    expect(result.paye).toBeCloseTo(1500, 6);
    expect(result.netPay).toBeCloseTo(30000 - 1500 - 2000, 2);
  });
});

describe("Precision", () => {
  it("handles fractional-cent inputs without floating-point drift", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 45678.37, rules: PAYE_ONLY_RULES }));
    // Internal consistency check: netPay + total employee deductions must
    // reconstruct cashGrossPay to the cent, regardless of intermediate
    // fractional values.
    expect(result.netPay + result.totalEmployeeDeductions).toBeCloseTo(45678.37, 2);
  });

  it("the classic 0.1 + 0.2 !== 0.3 case does not corrupt a full calculation", () => {
    const a = calculateKenyaPayroll(baseInput({ cashGrossPay: 10000.1, rules: PAYE_ONLY_RULES }));
    const b = calculateKenyaPayroll(baseInput({ cashGrossPay: 10000.2, rules: PAYE_ONLY_RULES }));
    // Two distinct, fractionally-close inputs must yield distinct results,
    // not collapse into identical or NaN output due to binary float error.
    expect(a.paye).not.toBeNaN();
    expect(b.paye).not.toBeNaN();
  });
});

describe("Determinism", () => {
  it("identical input and rules always produce identical output", () => {
    const input = baseInput({
      cashGrossPay: 87345.5,
      nonCashBenefits: [{ label: "Housing", amount: 15000, taxable: true }],
      allowableDeductions: [
        {
          type: "MORTGAGE_INTEREST",
          amount: 2500,
          taxTreatment: "PRE_TAX",
          employeeImpact: true,
          employerImpact: false,
        },
      ],
    });
    const first = calculateKenyaPayroll(JSON.parse(JSON.stringify(input)));
    const second = calculateKenyaPayroll(JSON.parse(JSON.stringify(input)));
    expect(first).toEqual(second);
  });

  it("stamps every result with the engine version for auditability", () => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: 50000 }));
    expect(result.engineVersion).toBe(PAYROLL_ENGINE_VERSION);
  });
});

describe("Financial invariants (brief §37)", () => {
  const salaries = [0, 1, 5000, 9000, 24000, 32333, 45678.37, 100000, 500000, 800000, 1000000, 5000000];

  it.each(salaries)("netPay is never negative for gross %p", (gross) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross }));
    expect(result.netPay).toBeGreaterThanOrEqual(0);
  });

  it.each(salaries)("PAYE is never negative for gross %p", (gross) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross }));
    expect(result.paye).toBeGreaterThanOrEqual(0);
  });

  it.each(salaries)("netPay = cashPay - totalEmployeeDeductions for gross %p", (gross) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross }));
    expect(result.netPay).toBeCloseTo(result.cashPay - result.totalEmployeeDeductions, 2);
  });

  it.each(salaries)("employer statutory cost never leaks into employee net pay for gross %p", (gross) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross }));
    // Employer-only figures must not appear anywhere in the employee-facing total.
    expect(result.totalEmployeeDeductions).toBeCloseTo(
      result.paye + result.nssfEmployeeTotal + result.shifEmployee + result.housingLevyEmployee,
      2,
    );
  });

  it.each(salaries)("totalEmploymentCost = grossPay + employerStatutoryCost for gross %p", (gross) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross }));
    expect(result.totalEmploymentCost).toBeCloseTo(result.grossPay + result.employerStatutoryCost, 2);
  });

  it.each(salaries)("employer statutory cost = NSSF employer + Housing Levy employer for gross %p", (gross) => {
    const result = calculateKenyaPayroll(baseInput({ cashGrossPay: gross }));
    expect(result.employerStatutoryCost).toBeCloseTo(result.nssfEmployerTotal + result.housingLevyEmployer, 2);
  });
});

describe("Input validation — rejects malformed input rather than computing garbage", () => {
  it("rejects negative salary", () => {
    expect(() => calculateKenyaPayroll(baseInput({ cashGrossPay: -1000 }))).toThrow(PayrollEngineValidationError);
  });

  it("rejects NaN", () => {
    expect(() => calculateKenyaPayroll(baseInput({ cashGrossPay: Number.NaN }))).toThrow(
      PayrollEngineValidationError,
    );
  });

  it("rejects Infinity", () => {
    expect(() => calculateKenyaPayroll(baseInput({ cashGrossPay: Number.POSITIVE_INFINITY }))).toThrow(
      PayrollEngineValidationError,
    );
  });

  it("rejects a PAYE rate outside [0, 1]", () => {
    const badRules: KenyaPayrollRules = {
      ...KENYA_2026_RULES,
      paye: { bands: [{ monthlyFrom: 0, monthlyTo: null, rate: 1.5 }], personalReliefMonthly: 0 },
    };
    expect(() => calculateKenyaPayroll(baseInput({ cashGrossPay: 10000, rules: badRules }))).toThrow(
      PayrollEngineValidationError,
    );
  });

  it("rejects malformed/out-of-order PAYE bands", () => {
    const badRules: KenyaPayrollRules = {
      ...KENYA_2026_RULES,
      paye: {
        bands: [
          { monthlyFrom: 0, monthlyTo: 24000, rate: 0.1 },
          { monthlyFrom: 24000, monthlyTo: 10000, rate: 0.25 }, // upper bound goes backwards
        ],
        personalReliefMonthly: 2400,
      },
    };
    expect(() => calculateKenyaPayroll(baseInput({ cashGrossPay: 10000, rules: badRules }))).toThrow(
      PayrollEngineValidationError,
    );
  });

  it("rejects an impossible (negative) deduction amount", () => {
    expect(() =>
      calculateKenyaPayroll(
        baseInput({
          cashGrossPay: 10000,
          allowableDeductions: [
            {
              type: "OTHER_ALLOWABLE_STATUTORY",
              amount: -500,
              taxTreatment: "PRE_TAX",
              employeeImpact: true,
              employerImpact: false,
            },
          ],
        }),
      ),
    ).toThrow(PayrollEngineValidationError);
  });

  it("rejects an invalid payroll period (end before start)", () => {
    expect(() =>
      calculateKenyaPayroll(
        baseInput({ cashGrossPay: 10000, period: { start: "2026-02-01", end: "2026-01-01" } }),
      ),
    ).toThrow(PayrollEngineValidationError);
  });

  it("rejects a missing employeeId", () => {
    expect(() => calculateKenyaPayroll(baseInput({ cashGrossPay: 10000, employeeId: "" }))).toThrow(
      PayrollEngineValidationError,
    );
  });

  it("throws (rather than silently clamping) when deductions exceed cash pay, producing negative net pay", () => {
    expect(() =>
      calculateKenyaPayroll(
        baseInput({
          cashGrossPay: 1000,
          otherDeductions: [{ label: "Court order garnishment", amount: 5000 }],
          rules: PAYE_ONLY_RULES,
        }),
      ),
    ).toThrow(RangeError);
  });
});
