import type { PermissionKey } from "@nexa/types";
import type { PayrollCalculationResult } from "@nexa/payroll-engine";

// Response shapes returned by apps/api — hand-written from the actual
// NestJS service implementations (Phase 2/3), not guessed. Kept here rather
// than inferred from Prisma directly so apps/web never needs @prisma/client
// as a dependency (brief §3: the browser/Next.js server never touches
// Postgres directly — this is the explicit boundary that keeps it that way).

export interface TenantSummary {
  organizationId: string;
  roleKey: string;
  permissions: PermissionKey[];
  isSuperAdminSession?: boolean;
}

export interface AuthSuccessResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string };
  tenant: TenantSummary;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    lastLoginAt: string | null;
  };
  tenant: TenantSummary & { isSuperAdminSession: boolean };
}

export interface MembershipSummary {
  organizationId: string;
  organizationDisplayName: string;
  organizationType: string;
  roleKey: string;
  roleName: string;
  status: "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";
}

export interface OrganizationSummary {
  id: string;
  type: string;
  legalName: string;
  displayName: string;
  taxIdentifier: string | null;
  countryCode: string;
  isActive: boolean;
  settings: unknown;
  parentOrganizationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMemberSummary {
  id: string;
  status: string;
  joinedAt: string | null;
  role: { key: string; name: string };
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isActive: boolean;
    lastLoginAt: string | null;
  };
}

export type PayrollRunStatus =
  | "DRAFT"
  | "CALCULATING"
  | "CALCULATED"
  | "UNDER_REVIEW"
  | "APPROVED"
  | "FINALIZED"
  | "VOIDED"
  | "FAILED";

export interface PayrollRunSummaryRow {
  id: string;
  organizationId: string;
  runType: "REGULAR" | "OFF_CYCLE" | "CORRECTION";
  status: PayrollRunStatus;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  currency: string;
  employeeCount: number;
  grossTotal: string;
  taxablePayTotal: string;
  payeTotal: string;
  nssfEmployeeTotal: string;
  nssfEmployerTotal: string;
  shifTotal: string;
  housingLevyEmployeeTotal: string;
  housingLevyEmployerTotal: string;
  otherDeductionsTotal: string;
  netPayrollTotal: string;
  totalEmploymentCost: string;
  engineVersion: string | null;
  createdByUserId: string;
  approvedByUserId: string | null;
  approvedAt: string | null;
  finalizedAt: string | null;
  voidedAt: string | null;
  voidedReason: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PayrollRecordRow {
  id: string;
  organizationId: string;
  employeeId: string;
  contractId: string | null;
  payrollRunId: string;
  payrollPeriodStart: string;
  payrollPeriodEnd: string;
  currency: string;
  grossPay: string;
  cashPay: string;
  nonCashBenefits: string;
  taxableBenefits: string;
  taxableIncome: string;
  payeBeforeRelief: string;
  personalRelief: string;
  otherReliefs: string;
  payeAmount: string;
  nssfEmployeeAmount: string;
  nssfEmployerAmount: string;
  shifAmount: string;
  housingLevyEmployeeAmount: string;
  housingLevyEmployerAmount: string;
  totalEmployeeDeductions: string;
  employerStatutoryCost: string;
  netPay: string;
  totalEmploymentCost: string;
  effectiveTaxRate: string;
  engineVersion: string;
  createdAt: string;
}

export interface PayrollRunSummaryReport {
  employeeCount: number;
  grossPayroll: number;
  taxablePayroll: number;
  paye: number;
  nssfEmployee: number;
  nssfEmployer: number;
  shif: number;
  housingLevyEmployee: number;
  housingLevyEmployer: number;
  otherDeductions: number;
  netPayroll: number;
  totalEmployerStatutoryCost: number;
  totalEmploymentCost: number;
}

export type { PayrollCalculationResult };

export type ContractType =
  | "PERMANENT_EMPLOYMENT"
  | "FIXED_TERM_EMPLOYMENT"
  | "CASUAL"
  | "TEMPORARY_STAFFING"
  | "OUTSOURCED_WORKFORCE"
  | "CONSULTING_ENGAGEMENT"
  | "CLIENT_SERVICES_AGREEMENT"
  | "INTERNSHIP";

export type ContractStatus = "DRAFT" | "PENDING_APPROVAL" | "ACTIVE" | "SUSPENDED" | "TERMINATED" | "EXPIRED";

export interface ContractRow {
  id: string;
  organizationId: string;
  employeeId: string | null;
  contractType: ContractType;
  status: ContractStatus;
  title: string;
  referenceCode: string | null;
  effectiveDate: string;
  expirationDate: string | null;
  baseCompensation: string | null;
  currency: string | null;
  paymentInterval: string | null;
  jobTitle: string | null;
  jobDescription: string | null;
  workLocation: string | null;
  workingHoursPerWeek: string | null;
  probationMonths: number | null;
  probationExtendedMonths: number | null;
  probationExtensionConsent: boolean | null;
  noticePeriodDays: number | null;
  continuousEmploymentDate: string | null;
  terms: unknown;
  documentStorageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ComplianceStatus = "PASS" | "WARNING" | "FAIL" | "REQUIRES_HUMAN_REVIEW";
export type ComplianceSeverity = "ERROR" | "WARNING";

export interface ComplianceViolationRow {
  ruleId: string;
  severity: ComplianceSeverity;
  field: string;
  message: string;
  legalBasis: string;
  remediation: string;
}

export interface ComplianceFindings {
  status: ComplianceStatus;
  score: number;
  violations: ComplianceViolationRow[];
  warnings: ComplianceViolationRow[];
  passedChecks: string[];
  requiredRemediation: string[];
  legalReferences: string[];
}

export interface ComplianceSummary {
  totalContracts: number;
  evaluatedContracts: number;
  PASS: number;
  WARNING: number;
  FAIL: number;
  REQUIRES_HUMAN_REVIEW: number;
  neverEvaluated: number;
  contractsRequiringReview: { id: string; title: string; status: string }[];
}

export type EmploymentIdentityStatus = "ACTIVE" | "ON_LEAVE" | "SUSPENDED" | "TERMINATED";

export interface EmployeeRow {
  id: string;
  organizationId: string;
  userId: string | null;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  phone: string | null;
  status: EmploymentIdentityStatus;
  hireDate: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// AI orchestration (apps/ai, proxied through apps/api's /ai/* and
// /contracts/:id/ai-audit routes — see apps/api/src/ai). `result`'s field
// names are snake_case, unlike the rest of this file's camelCase
// convention: it is the raw JSON produced by apps/ai's Pydantic models
// (apps/ai/app/schemas/*.py) via model_dump(mode="json"), passed through
// apps/api unmodified rather than remapped, so it stays byte-identical to
// what apps/ai actually validated and audited.
// ---------------------------------------------------------------------------

export type AiJobStatus = "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";

export type AiContractAuditSeverity = "INFO" | "ADVISORY" | "CONCERN";

export interface AiContractAuditFinding {
  category: string;
  severity: AiContractAuditSeverity;
  observation: string;
  recommendation: string;
}

export interface AiContractAuditResult {
  summary: string;
  overall_assessment: "LOOKS_SOUND" | "MINOR_SUGGESTIONS" | "SIGNIFICANT_CONCERNS";
  findings: AiContractAuditFinding[];
  disclaimer: string;
}

export interface AiJobAccepted {
  jobId: string;
  status: string;
}

export interface AiJobStatusResponse {
  jobId: string;
  agentType: string;
  status: AiJobStatus;
  promptVersion: string;
  result: AiContractAuditResult | null;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface ComplianceEvaluationRow {
  id: string;
  organizationId: string;
  subjectType: "CONTRACT" | "PAYROLL_RUN" | "EMPLOYEE";
  contractId: string | null;
  payrollRunId: string | null;
  employeeId: string | null;
  status: ComplianceStatus;
  score: string | null;
  findings: ComplianceFindings;
  ruleEngineVersion: string;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  createdAt: string;
}
