import {
  PayrollEngineValidationError,
  type KenyaPayrollRules,
  type PayrollCalculationInput,
} from "./types";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validateRate(value: unknown, label: string, violations: string[]): void {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    violations.push(`${label} must be a finite number between 0 and 1, received: ${value}`);
  }
}

function validateRules(rules: KenyaPayrollRules, violations: string[]): void {
  if (rules.jurisdiction !== "KE") {
    violations.push(`Unsupported jurisdiction: ${rules.jurisdiction as string} (this engine only implements KE)`);
  }

  if (!rules.paye || rules.paye.bands.length === 0) {
    violations.push("rules.paye.bands must contain at least one band");
  } else {
    let previousUpperBound = 0;
    rules.paye.bands.forEach((band, index) => {
      if (!isFiniteNumber(band.monthlyFrom) || band.monthlyFrom < 0) {
        violations.push(`rules.paye.bands[${index}].monthlyFrom must be a non-negative finite number`);
      }
      if (band.monthlyTo !== null && (!isFiniteNumber(band.monthlyTo) || band.monthlyTo <= previousUpperBound)) {
        violations.push(
          `rules.paye.bands[${index}].monthlyTo must be greater than the previous band's upper bound, or null for the top band`,
        );
      }
      validateRate(band.rate, `rules.paye.bands[${index}].rate`, violations);
      if (band.monthlyTo !== null) {
        previousUpperBound = band.monthlyTo;
      } else if (index !== rules.paye.bands.length - 1) {
        violations.push(`rules.paye.bands[${index}] has monthlyTo=null but is not the last band`);
      }
    });
  }
  if (!isFiniteNumber(rules.paye?.personalReliefMonthly) || rules.paye.personalReliefMonthly < 0) {
    violations.push("rules.paye.personalReliefMonthly must be a non-negative finite number");
  }

  if (!rules.nssf || rules.nssf.tiers.length === 0) {
    violations.push("rules.nssf.tiers must contain at least one tier");
  } else {
    rules.nssf.tiers.forEach((tier, index) => {
      if (!isFiniteNumber(tier.lowerLimit) || tier.lowerLimit < 0) {
        violations.push(`rules.nssf.tiers[${index}].lowerLimit must be a non-negative finite number`);
      }
      if (!isFiniteNumber(tier.upperLimit) || tier.upperLimit <= tier.lowerLimit) {
        violations.push(`rules.nssf.tiers[${index}].upperLimit must be greater than lowerLimit`);
      }
      validateRate(tier.employeeRate, `rules.nssf.tiers[${index}].employeeRate`, violations);
      validateRate(tier.employerRate, `rules.nssf.tiers[${index}].employerRate`, violations);
    });
  }

  validateRate(rules.shif?.rate, "rules.shif.rate", violations);
  validateRate(rules.housingLevy?.employeeRate, "rules.housingLevy.employeeRate", violations);
  validateRate(rules.housingLevy?.employerRate, "rules.housingLevy.employerRate", violations);
}

export function validatePayrollCalculationInput(input: PayrollCalculationInput): void {
  const violations: string[] = [];

  if (!input.employeeId || input.employeeId.trim().length === 0) {
    violations.push("employeeId is required");
  }
  if (!input.currency || input.currency.length !== 3) {
    violations.push(`currency must be a 3-letter ISO 4217 code, received: ${input.currency}`);
  }
  if (!input.period?.start || !input.period?.end) {
    violations.push("period.start and period.end are required");
  } else {
    const start = new Date(input.period.start);
    const end = new Date(input.period.end);
    if (Number.isNaN(start.getTime())) {
      violations.push(`period.start is not a valid date: ${input.period.start}`);
    }
    if (Number.isNaN(end.getTime())) {
      violations.push(`period.end is not a valid date: ${input.period.end}`);
    }
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end < start) {
      violations.push("period.end must not be before period.start");
    }
  }

  if (!isFiniteNumber(input.cashGrossPay) || input.cashGrossPay < 0) {
    violations.push(`cashGrossPay must be a non-negative finite number, received: ${input.cashGrossPay}`);
  }

  input.nonCashBenefits.forEach((benefit, index) => {
    if (!isFiniteNumber(benefit.amount) || benefit.amount < 0) {
      violations.push(`nonCashBenefits[${index}].amount must be a non-negative finite number`);
    }
  });

  input.allowableDeductions.forEach((deduction, index) => {
    if (!isFiniteNumber(deduction.amount) || deduction.amount < 0) {
      violations.push(`allowableDeductions[${index}].amount must be a non-negative finite number`);
    }
  });

  input.otherDeductions.forEach((deduction, index) => {
    if (!isFiniteNumber(deduction.amount) || deduction.amount < 0) {
      violations.push(`otherDeductions[${index}].amount must be a non-negative finite number`);
    }
  });

  if (!input.rules) {
    violations.push("rules is required");
  } else {
    validateRules(input.rules, violations);
  }

  if (violations.length > 0) {
    throw new PayrollEngineValidationError(violations);
  }
}
