import { ConflictException } from "@nestjs/common";
import type { $Enums } from "@prisma/client";

type PayrollRunStatus = $Enums.PayrollRunStatus;

// Pure state machine — no DB, no Nest DI beyond the exception type. Brief
// §20: "Do not allow arbitrary state changes." FINALIZED and VOIDED are
// terminal: a finalized payroll must not be silently recalculated or
// overwritten (brief §20, §38) — a correction is a new CORRECTION-type run
// (see PayrollService), never a mutation of a finalized one.
export const PAYROLL_RUN_TRANSITIONS: Record<PayrollRunStatus, readonly PayrollRunStatus[]> = {
  DRAFT: ["CALCULATING", "VOIDED"],
  CALCULATING: ["CALCULATED", "FAILED"],
  // Recalculating before approval is a legitimate correction path (e.g. an
  // employee record was fixed after a first calculation) — still allowed
  // right up until APPROVED, after which it is not. APPROVED is reachable
  // directly from CALCULATED (skipping an explicit "start review" step) OR
  // via UNDER_REVIEW — both are valid, since brief §23's minimum API surface
  // has no dedicated "start review" endpoint, but UNDER_REVIEW remains a
  // real, independently reachable state for a future reviewer-assignment flow.
  CALCULATED: ["UNDER_REVIEW", "CALCULATING", "VOIDED", "APPROVED"],
  UNDER_REVIEW: ["APPROVED", "CALCULATING", "VOIDED"],
  APPROVED: ["FINALIZED", "VOIDED"],
  FINALIZED: [],
  VOIDED: [],
  FAILED: ["CALCULATING", "VOIDED"],
};

export class InvalidPayrollTransitionError extends ConflictException {
  constructor(from: PayrollRunStatus, to: PayrollRunStatus) {
    super(`Cannot transition payroll run from ${from} to ${to}`);
  }
}

export function assertValidPayrollTransition(from: PayrollRunStatus, to: PayrollRunStatus): void {
  const allowed = PAYROLL_RUN_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    throw new InvalidPayrollTransitionError(from, to);
  }
}

export function isTerminalPayrollStatus(status: PayrollRunStatus): boolean {
  return PAYROLL_RUN_TRANSITIONS[status].length === 0;
}
