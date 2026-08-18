import type { ComplianceResult, ComplianceViolation } from "@nexa/types";
import type { ComplianceRuleset, ContractComplianceInput } from "./types";

// Deterministic, rule-driven validation against Kenya's Employment Act 2007
// (brief §27-§30). No LLM/AI reasoning here (brief §33: "the deterministic
// compliance engine remains authoritative for known rules") — every
// threshold below comes from the versioned ComplianceRuleset passed in,
// never a constant in this file. This is a pure function: no Prisma, no
// Nest DI, no I/O — trivially unit-testable and reusable from a background
// job later if needed.

const COMPLIANCE_ENGINE_VERSION = "1.0.0";

function daysBetween(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function isLongTermContractType(contractType: string): boolean {
  return contractType === "PERMANENT_EMPLOYMENT" || contractType === "FIXED_TERM_EMPLOYMENT";
}

export function validateContractCompliance(
  contract: ContractComplianceInput,
  rules: ComplianceRuleset,
): ComplianceResult {
  const violations: ComplianceViolation[] = [];
  const warnings: ComplianceViolation[] = [];
  const passedChecks: string[] = [];
  let requiresHumanReview = false;

  // --- Section 10: employment particulars ---------------------------------
  const engagementDurationDays = contract.expirationDate
    ? daysBetween(contract.effectiveDate, contract.expirationDate)
    : Number.POSITIVE_INFINITY; // open-ended (e.g. PERMANENT) always qualifies

  const particularsRequired =
    isLongTermContractType(contract.contractType) ||
    engagementDurationDays >= rules.writtenContractRequired.minimumAggregateDays;

  if (particularsRequired) {
    const requiredFieldChecks: Array<[string, unknown]> = [
      ["jobTitle", contract.jobTitle],
      ["jobDescription", contract.jobDescription],
      ["workLocation", contract.workLocation],
      ["workingHoursPerWeek", contract.workingHoursPerWeek],
      ["baseCompensation", contract.baseCompensation],
      ["paymentInterval", contract.paymentInterval],
    ];
    const missingFields = requiredFieldChecks.filter(([, value]) => value === null || value === undefined);

    if (missingFields.length > 0) {
      violations.push({
        ruleId: "EMPLOYMENT_PARTICULARS_REQUIRED",
        severity: "ERROR",
        field: missingFields.map(([field]) => field).join(", "),
        message: `Contract is missing required Employment Act particulars: ${missingFields
          .map(([field]) => field)
          .join(", ")}.`,
        legalBasis: "Employment Act 2007 (Kenya), Section 10",
        remediation: "Populate all required employment particulars before this contract can be marked compliant.",
      });
    } else {
      passedChecks.push("EMPLOYMENT_PARTICULARS_REQUIRED");
    }
  } else {
    passedChecks.push("EMPLOYMENT_PARTICULARS_REQUIRED (not applicable — engagement below the statutory threshold)");
  }

  // --- Section 42(2): probation duration -----------------------------------
  if (contract.probationMonths !== null) {
    const rule = rules.probationMaximumDuration;
    if (contract.probationMonths > rule.initialMaximumMonths && contract.probationExtendedMonths === null) {
      violations.push({
        ruleId: "PROBATION_MAXIMUM_DURATION",
        severity: "ERROR",
        field: "probationMonths",
        message: `Initial probation of ${contract.probationMonths} months exceeds the statutory maximum of ${rule.initialMaximumMonths} months.`,
        legalBasis: "Employment Act 2007 (Kenya), Section 42(2)",
        remediation: `Reduce the initial probation period to ${rule.initialMaximumMonths} months or fewer.`,
      });
    } else if (contract.probationExtendedMonths !== null) {
      const totalMonths = contract.probationMonths + contract.probationExtendedMonths;
      if (rule.extensionRequiresWrittenConsent && contract.probationExtensionConsent !== true) {
        violations.push({
          ruleId: "PROBATION_MAXIMUM_DURATION",
          severity: "ERROR",
          field: "probationExtensionConsent",
          message: "Probation extension is recorded but the employee's written consent is not confirmed.",
          legalBasis: "Employment Act 2007 (Kenya), Section 42(2)",
          remediation: "Obtain and record the employee's written agreement before extending probation.",
        });
      } else if (totalMonths > rule.totalMaximumMonths) {
        violations.push({
          ruleId: "PROBATION_MAXIMUM_DURATION",
          severity: "ERROR",
          field: "probationExtendedMonths",
          message: `Total probation (initial ${contract.probationMonths} + extension ${contract.probationExtendedMonths} = ${totalMonths} months) exceeds the statutory maximum of ${rule.totalMaximumMonths} months.`,
          legalBasis: "Employment Act 2007 (Kenya), Section 42(2)",
          remediation: `Reduce the combined probation period to ${rule.totalMaximumMonths} months or fewer.`,
        });
      } else {
        passedChecks.push("PROBATION_MAXIMUM_DURATION");
      }
    } else {
      passedChecks.push("PROBATION_MAXIMUM_DURATION");
    }
  } else {
    passedChecks.push("PROBATION_MAXIMUM_DURATION (no probation period set)");
  }

  // --- Section 35: minimum notice period -----------------------------------
  if (contract.noticePeriodDays !== null) {
    const rule = rules.noticePeriodMinimum;
    const isMonthlyOrLonger = contract.paymentInterval !== "DAILY";
    const requiredNoticeDays = isMonthlyOrLonger
      ? rule.monthlyOrLongerContractsNoticeDays
      : rule.dailyContractsNoticeDays;

    if (contract.noticePeriodDays < requiredNoticeDays) {
      violations.push({
        ruleId: "NOTICE_PERIOD_MINIMUM",
        severity: "ERROR",
        field: "noticePeriodDays",
        message: `Notice period of ${contract.noticePeriodDays} days is below the statutory minimum of ${requiredNoticeDays} days for this contract's payment interval.`,
        legalBasis: "Employment Act 2007 (Kenya), Section 35",
        remediation: `Set noticePeriodDays to at least ${requiredNoticeDays}.`,
      });
    } else {
      passedChecks.push("NOTICE_PERIOD_MINIMUM");
    }
  } else {
    warnings.push({
      ruleId: "NOTICE_PERIOD_MINIMUM",
      severity: "WARNING",
      field: "noticePeriodDays",
      message: "No notice period is recorded on this contract.",
      legalBasis: "Employment Act 2007 (Kenya), Section 35",
      remediation: "Record an explicit notice period consistent with the statutory minimum.",
    });
  }

  // --- Section 37: casual -> monthly conversion ----------------------------
  if (contract.contractType === "CASUAL") {
    const rule = rules.casualConversionThreshold;
    const engagedDays = contract.expirationDate
      ? daysBetween(contract.effectiveDate, contract.expirationDate)
      : daysBetween(contract.effectiveDate, new Date());

    if (engagedDays >= rule.continuousServiceThresholdDays) {
      violations.push({
        ruleId: "CASUAL_CONVERSION_THRESHOLD",
        severity: "ERROR",
        field: "contractType",
        message: `This engagement has run ${engagedDays} continuous days, at or beyond the ${rule.continuousServiceThresholdDays}-day threshold — it can no longer be classified CASUAL regardless of the employer's stated preference.`,
        legalBasis: "Employment Act 2007 (Kenya), Section 37",
        remediation: `Reclassify this contract: ${rule.convertsToDescription}.`,
      });
    } else {
      passedChecks.push("CASUAL_CONVERSION_THRESHOLD");
    }
  }

  // --- Contract-type structural checks --------------------------------------
  if (contract.contractType === "PERMANENT_EMPLOYMENT" && contract.expirationDate !== null) {
    violations.push({
      ruleId: "CONTRACT_TYPE_STRUCTURE",
      severity: "ERROR",
      field: "expirationDate",
      message: "A PERMANENT_EMPLOYMENT contract must not have an expiration date (it must be indefinite).",
      legalBasis: "Employment Act 2007 (Kenya), Section 10(e) — form and duration of the contract",
      remediation: "Remove the expiration date, or reclassify as FIXED_TERM_EMPLOYMENT.",
    });
  } else if (contract.contractType === "FIXED_TERM_EMPLOYMENT" && contract.expirationDate === null) {
    violations.push({
      ruleId: "CONTRACT_TYPE_STRUCTURE",
      severity: "ERROR",
      field: "expirationDate",
      message: "A FIXED_TERM_EMPLOYMENT contract must specify an expiration date.",
      legalBasis: "Employment Act 2007 (Kenya), Section 10(e) — form and duration of the contract",
      remediation: "Set an expiration date, or reclassify as PERMANENT_EMPLOYMENT.",
    });
  } else {
    passedChecks.push("CONTRACT_TYPE_STRUCTURE");
  }

  // --- Outsourced BPO: employer-of-record ambiguity cannot be fully
  // automated without an explicit employer-of-record field, which this
  // schema does not yet model — surfaced honestly as REQUIRES_HUMAN_REVIEW
  // rather than a fabricated pass.
  if (contract.contractType === "OUTSOURCED_WORKFORCE") {
    requiresHumanReview = true;
    warnings.push({
      ruleId: "OUTSOURCED_EMPLOYER_OF_RECORD",
      severity: "WARNING",
      field: "contractType",
      message:
        "OUTSOURCED_WORKFORCE contracts require explicit human confirmation of which entity (Nexa vs. the operational client) is the legal employer of record — this cannot be determined automatically from the current data model.",
      legalBasis: "Employment Act 2007 (Kenya), Section 10(b) — name of the employer",
      remediation: "A reviewer must confirm the employer-of-record designation in the contract terms before approval.",
    });
  }

  const errorCount = violations.length;
  const totalChecks = passedChecks.length + violations.length;
  const score = totalChecks === 0 ? 0 : Math.round((passedChecks.length / totalChecks) * 10000) / 100;

  let status: ComplianceResult["status"];
  if (errorCount > 0) {
    status = "FAIL";
  } else if (requiresHumanReview) {
    status = "REQUIRES_HUMAN_REVIEW";
  } else if (warnings.length > 0) {
    status = "WARNING";
  } else {
    status = "PASS";
  }

  return {
    status,
    score,
    violations,
    warnings,
    passedChecks,
    requiredRemediation: violations.map((v) => v.remediation),
    legalReferences: [...new Set([...violations, ...warnings].map((v) => v.legalBasis))],
  };
}

export { COMPLIANCE_ENGINE_VERSION };
