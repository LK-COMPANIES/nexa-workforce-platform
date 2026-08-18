// -----------------------------------------------------------------------------
// Explicit, strongly-typed contracts — deliberately no generic/ambiguous
// `object`/`Record<string, unknown>` shapes for anything the engine reads.
// -----------------------------------------------------------------------------

export interface PayeBandRule {
  /** Documentation only — the calculator derives band width from `monthlyTo` and array order, not this field. */
  monthlyFrom: number;
  /** Inclusive upper bound of this band, in the period's currency. `null` marks the open-ended top band. */
  monthlyTo: number | null;
  /** Marginal rate for income within this band, as a fraction (0.1 = 10%). */
  rate: number;
}

export interface PayeRules {
  bands: PayeBandRule[];
  personalReliefMonthly: number;
}

export interface NssfTierRule {
  tier: "I" | "II";
  lowerLimit: number;
  upperLimit: number;
  employeeRate: number;
  employerRate: number;
}

export interface NssfRules {
  tiers: NssfTierRule[];
}

export interface ShifRules {
  rate: number;
  minimumMonthlyContribution: number | null;
  cap: number | null;
}

export interface HousingLevyRules {
  employeeRate: number;
  employerRate: number;
  cap: number | null;
}

/** A supplied statutory ruleset — the engine calculates FROM this, never from constants of its own. */
export interface KenyaPayrollRules {
  jurisdiction: "KE";
  paye: PayeRules;
  nssf: NssfRules;
  shif: ShifRules;
  housingLevy: HousingLevyRules;
  /** Optional traceability: the specific StatutoryRuleVersion id used for each instrument, echoed into calculationSteps. */
  ruleVersionIds?: {
    paye?: string;
    nssf?: string;
    shif?: string;
    housingLevy?: string;
  };
}

export type AllowableDeductionType =
  | "APPROVED_PENSION_CONTRIBUTION"
  | "MORTGAGE_INTEREST"
  | "POST_RETIREMENT_MEDICAL_FUND"
  | "OTHER_ALLOWABLE_STATUTORY";

export type DeductionTaxTreatment = "PRE_TAX" | "POST_TAX";

/** A deduction with an explicit statutory classification — never a bare number subtracted from gross. */
export interface AllowableDeductionInput {
  type: AllowableDeductionType;
  amount: number;
  taxTreatment: DeductionTaxTreatment;
  /** Whether this reduces the employee's net pay. */
  employeeImpact: boolean;
  /** Whether this is also an employer cost/liability (e.g. an employer pension match). */
  employerImpact: boolean;
  description?: string;
}

/** A non-statutory deduction (e.g. a salary advance repayment) — always post-tax, always employee-impacting. */
export interface NonStatutoryDeductionInput {
  label: string;
  amount: number;
}

/**
 * A non-cash benefit. `taxable` is supplied by the caller (derived from the
 * ruleset/benefit catalog upstream), never inferred here — brief §6: "the
 * ruleset must determine the treatment," not this engine.
 */
export interface NonCashBenefitInput {
  label: string;
  amount: number;
  taxable: boolean;
}

export interface PayrollPeriod {
  /** ISO 8601 date, e.g. "2026-01-01" */
  start: string;
  end: string;
}

export interface PayrollCalculationInput {
  employeeId: string;
  period: PayrollPeriod;
  /** ISO 4217, e.g. "KES" */
  currency: string;
  cashGrossPay: number;
  nonCashBenefits: NonCashBenefitInput[];
  allowableDeductions: AllowableDeductionInput[];
  otherDeductions: NonStatutoryDeductionInput[];
  taxResidencyStatus: "RESIDENT" | "NON_RESIDENT";
  rules: KenyaPayrollRules;
}

export interface CalculationStep {
  type: string;
  base: number;
  rate: number | null;
  amount: number;
  statutoryRuleId?: string;
  description: string;
}

export interface PayrollCalculationResult {
  employeeId: string;
  currency: string;

  grossPay: number;
  cashPay: number;
  nonCashBenefits: number;
  taxableBenefits: number;
  totalEmploymentIncome: number;
  preTaxDeductions: number;
  taxablePay: number;

  nssfTier1Employee: number;
  nssfTier2Employee: number;
  nssfEmployeeTotal: number;
  nssfTier1Employer: number;
  nssfTier2Employer: number;
  nssfEmployerTotal: number;

  shifEmployee: number;
  shifCalculationBase: number;

  housingLevyEmployee: number;
  housingLevyEmployer: number;

  allowableDeductionsTotal: number;
  otherDeductionsTotal: number;

  payeBeforeRelief: number;
  personalRelief: number;
  otherReliefs: number;
  paye: number;

  totalEmployeeDeductions: number;
  employerStatutoryCost: number;
  netPay: number;
  totalEmploymentCost: number;
  effectiveTaxRate: number;

  calculationSteps: CalculationStep[];
  engineVersion: string;
}

export class PayrollEngineValidationError extends Error {
  constructor(public readonly violations: string[]) {
    super(`Invalid payroll calculation input: ${violations.join("; ")}`);
    this.name = "PayrollEngineValidationError";
  }
}
