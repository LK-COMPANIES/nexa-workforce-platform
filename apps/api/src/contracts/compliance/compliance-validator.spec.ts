import { validateContractCompliance } from "./compliance-validator";
import type { ComplianceRuleset, ContractComplianceInput } from "./types";

// Mirrors exactly the ruleDefinition JSON seeded in
// packages/database/prisma/seed.ts (KENYA_EMPLOYMENT_ACT_COMPLIANCE_RULES).
const RULES: ComplianceRuleset = {
  ruleVersionIds: {
    writtenContractRequired: "rule-written",
    employmentParticularsRequired: "rule-particulars",
    probationMaximumDuration: "rule-probation",
    noticePeriodMinimum: "rule-notice",
    casualConversionThreshold: "rule-casual",
  },
  writtenContractRequired: { minimumAggregateDays: 90, alsoRequiredForSpecifiedWork: true },
  employmentParticularsRequired: {
    requiredFields: ["jobTitle", "jobDescription"],
    mustBeProvidedWithinDaysOfCommencement: 60,
  },
  probationMaximumDuration: {
    initialMaximumMonths: 6,
    extensionMaximumMonths: 6,
    totalMaximumMonths: 12,
    extensionRequiresWrittenConsent: true,
  },
  noticePeriodMinimum: {
    dailyContractsNoticeDays: 0,
    subMonthlyContractsNoticePeriods: 1,
    monthlyOrLongerContractsNoticeDays: 28,
  },
  casualConversionThreshold: { continuousServiceThresholdDays: 30, convertsToDescription: "Monthly-wage contract" },
};

function baseContract(overrides: Partial<ContractComplianceInput> = {}): ContractComplianceInput {
  return {
    contractType: "PERMANENT_EMPLOYMENT",
    effectiveDate: new Date("2026-01-01"),
    expirationDate: null,
    jobTitle: "Software Engineer",
    jobDescription: "Builds and maintains software systems.",
    workLocation: "Nairobi, Kenya",
    workingHoursPerWeek: 45,
    baseCompensation: 150000,
    paymentInterval: "MONTHLY",
    probationMonths: 3,
    probationExtendedMonths: null,
    probationExtensionConsent: null,
    noticePeriodDays: 28,
    continuousEmploymentDate: new Date("2026-01-01"),
    ...overrides,
  };
}

describe("validateContractCompliance — Employment Act 2007", () => {
  it("passes a fully compliant permanent contract", () => {
    const result = validateContractCompliance(baseContract(), RULES);
    expect(result.status).toBe("PASS");
    expect(result.violations).toHaveLength(0);
  });

  it("FAILs (not warns) when required Section 10 particulars are missing on a qualifying contract", () => {
    const result = validateContractCompliance(baseContract({ jobDescription: null, workLocation: null }), RULES);
    expect(result.status).toBe("FAIL");
    expect(result.violations.some((v) => v.ruleId === "EMPLOYMENT_PARTICULARS_REQUIRED")).toBe(true);
    expect(result.violations.every((v) => v.severity === "ERROR" || v.ruleId !== "EMPLOYMENT_PARTICULARS_REQUIRED")).toBe(
      true,
    );
  });

  it("does not require full particulars for a short casual engagement below the statutory threshold", () => {
    const result = validateContractCompliance(
      baseContract({
        contractType: "CASUAL",
        jobDescription: null,
        workLocation: null,
        effectiveDate: new Date("2026-01-01"),
        expirationDate: new Date("2026-01-05"), // 4 days — well under 90
        probationMonths: null,
      }),
      RULES,
    );
    expect(result.violations.some((v) => v.ruleId === "EMPLOYMENT_PARTICULARS_REQUIRED")).toBe(false);
  });

  describe("probation (Employment Act s.42(2))", () => {
    it("passes probation within the 6-month initial maximum", () => {
      const result = validateContractCompliance(baseContract({ probationMonths: 6 }), RULES);
      expect(result.violations.some((v) => v.ruleId === "PROBATION_MAXIMUM_DURATION")).toBe(false);
    });

    it("FAILs (ERROR severity, not a warning) when initial probation exceeds 6 months with no extension recorded", () => {
      const result = validateContractCompliance(baseContract({ probationMonths: 9 }), RULES);
      const violation = result.violations.find((v) => v.ruleId === "PROBATION_MAXIMUM_DURATION");
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe("ERROR");
      expect(result.status).toBe("FAIL");
    });

    it("requires written consent to extend probation, even within the total cap", () => {
      const result = validateContractCompliance(
        baseContract({ probationMonths: 6, probationExtendedMonths: 3, probationExtensionConsent: false }),
        RULES,
      );
      const violation = result.violations.find((v) => v.ruleId === "PROBATION_MAXIMUM_DURATION");
      expect(violation?.field).toBe("probationExtensionConsent");
    });

    it("allows an extension up to the 12-month combined total with consent", () => {
      const result = validateContractCompliance(
        baseContract({ probationMonths: 6, probationExtendedMonths: 6, probationExtensionConsent: true }),
        RULES,
      );
      expect(result.violations.some((v) => v.ruleId === "PROBATION_MAXIMUM_DURATION")).toBe(false);
    });

    it("rejects a combined probation beyond the 12-month total even with consent", () => {
      const result = validateContractCompliance(
        baseContract({ probationMonths: 6, probationExtendedMonths: 7, probationExtensionConsent: true }),
        RULES,
      );
      const violation = result.violations.find((v) => v.ruleId === "PROBATION_MAXIMUM_DURATION");
      expect(violation?.field).toBe("probationExtendedMonths");
    });
  });

  describe("notice period (Employment Act s.35)", () => {
    it("rejects a monthly contract with less than 28 days notice", () => {
      const result = validateContractCompliance(baseContract({ noticePeriodDays: 14 }), RULES);
      expect(result.violations.some((v) => v.ruleId === "NOTICE_PERIOD_MINIMUM")).toBe(true);
      expect(result.status).toBe("FAIL");
    });

    it("warns (does not fail) when no notice period is recorded at all", () => {
      const result = validateContractCompliance(baseContract({ noticePeriodDays: null }), RULES);
      expect(result.warnings.some((v) => v.ruleId === "NOTICE_PERIOD_MINIMUM")).toBe(true);
      expect(result.violations.some((v) => v.ruleId === "NOTICE_PERIOD_MINIMUM")).toBe(false);
    });
  });

  describe("casual conversion (Employment Act s.37)", () => {
    it("does not flag a CASUAL contract still under the 30-day threshold", () => {
      const result = validateContractCompliance(
        baseContract({
          contractType: "CASUAL",
          effectiveDate: new Date("2026-01-01"),
          expirationDate: new Date("2026-01-15"),
          probationMonths: null,
        }),
        RULES,
      );
      expect(result.violations.some((v) => v.ruleId === "CASUAL_CONVERSION_THRESHOLD")).toBe(false);
    });

    it("FAILs a CASUAL contract engaged 30+ continuous days — cannot stay labeled casual by employer choice alone", () => {
      const result = validateContractCompliance(
        baseContract({
          contractType: "CASUAL",
          effectiveDate: new Date("2026-01-01"),
          expirationDate: new Date("2026-02-15"), // 45 days
          probationMonths: null,
        }),
        RULES,
      );
      const violation = result.violations.find((v) => v.ruleId === "CASUAL_CONVERSION_THRESHOLD");
      expect(violation).toBeDefined();
      expect(violation?.severity).toBe("ERROR");
    });
  });

  describe("contract-type structure", () => {
    it("rejects a PERMANENT contract with an expiration date", () => {
      const result = validateContractCompliance(
        baseContract({ contractType: "PERMANENT_EMPLOYMENT", expirationDate: new Date("2027-01-01") }),
        RULES,
      );
      expect(result.violations.some((v) => v.ruleId === "CONTRACT_TYPE_STRUCTURE")).toBe(true);
    });

    it("rejects a FIXED_TERM contract with no expiration date", () => {
      const result = validateContractCompliance(
        baseContract({ contractType: "FIXED_TERM_EMPLOYMENT", expirationDate: null }),
        RULES,
      );
      expect(result.violations.some((v) => v.ruleId === "CONTRACT_TYPE_STRUCTURE")).toBe(true);
    });
  });

  describe("outsourced BPO", () => {
    it("flags REQUIRES_HUMAN_REVIEW rather than fabricating a pass for employer-of-record ambiguity", () => {
      const result = validateContractCompliance(
        baseContract({ contractType: "OUTSOURCED_WORKFORCE", expirationDate: new Date("2027-01-01") }),
        RULES,
      );
      expect(result.status).toBe("REQUIRES_HUMAN_REVIEW");
      expect(result.warnings.some((v) => v.ruleId === "OUTSOURCED_EMPLOYER_OF_RECORD")).toBe(true);
    });
  });

  it("never declares a contract compliant merely because required fields are present (probation still checked)", () => {
    // All Section 10 particulars present, but probation illegally long.
    const result = validateContractCompliance(baseContract({ probationMonths: 24 }), RULES);
    expect(result.status).toBe("FAIL");
  });

  it("includes legal references for every finding, never a bare assertion", () => {
    const result = validateContractCompliance(baseContract({ probationMonths: 9 }), RULES);
    expect(result.legalReferences.length).toBeGreaterThan(0);
    expect(result.legalReferences.every((ref) => ref.includes("Employment Act"))).toBe(true);
  });
});
