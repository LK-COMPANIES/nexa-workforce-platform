// Mirrors ComplianceRuleType / ComplianceStatus / ComplianceSubjectType in
// schema.prisma.
export const COMPLIANCE_RULE_TYPES = [
  "PROBATION_MAXIMUM_DURATION",
  "WRITTEN_CONTRACT_REQUIRED",
  "NOTICE_PERIOD_MINIMUM",
  "CASUAL_CONVERSION_THRESHOLD",
  "EMPLOYMENT_PARTICULARS_REQUIRED",
] as const;
export type ComplianceRuleType = (typeof COMPLIANCE_RULE_TYPES)[number];

export const COMPLIANCE_STATUSES = ["PASS", "WARNING", "FAIL", "REQUIRES_HUMAN_REVIEW"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const COMPLIANCE_SUBJECT_TYPES = ["CONTRACT", "PAYROLL_RUN", "EMPLOYEE"] as const;
export type ComplianceSubjectType = (typeof COMPLIANCE_SUBJECT_TYPES)[number];

export const COMPLIANCE_SEVERITIES = ["ERROR", "WARNING"] as const;
export type ComplianceSeverity = (typeof COMPLIANCE_SEVERITIES)[number];

export interface ComplianceViolation {
  ruleId: string;
  severity: ComplianceSeverity;
  field: string;
  message: string;
  legalBasis: string;
  remediation: string;
}

export interface ComplianceResult {
  status: ComplianceStatus;
  score: number;
  violations: ComplianceViolation[];
  warnings: ComplianceViolation[];
  passedChecks: string[];
  requiredRemediation: string[];
  legalReferences: string[];
}
