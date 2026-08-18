import { Injectable } from "@nestjs/common";
import type { Contract, Employee } from "@prisma/client";
import { calculateKenyaPayroll, type KenyaPayrollRules, type PayrollCalculationResult } from "@nexa/payroll-engine";

// Adapts Employee/Contract DB rows into the pure engine's input contract.
// This is the ONLY place that translation happens — the engine itself never
// sees a Prisma model.
//
// Documented Phase 3 scope boundary: Employee/Contract do not yet model
// per-employee non-cash benefits, individual allowable-deduction elections
// (pension %, mortgage interest amount, etc.), or tax residency status —
// those are legitimate future data-model additions, not something this
// service fakes. The engine itself already fully supports all of them
// (see packages/payroll-engine/src/types.ts); this adapter simply has
// nothing to source them from yet, so it passes empty arrays / a RESIDENT
// default rather than inventing employee-specific data.
@Injectable()
export class PayrollCalculationService {
  calculateForEmployee(
    employee: Employee,
    contract: Contract | null,
    rules: KenyaPayrollRules,
    period: { start: Date; end: Date },
    currency: string,
  ): PayrollCalculationResult {
    const cashGrossPay = contract?.baseCompensation ? Number(contract.baseCompensation) : 0;

    return calculateKenyaPayroll({
      employeeId: employee.id,
      period: {
        start: period.start.toISOString().slice(0, 10),
        end: period.end.toISOString().slice(0, 10),
      },
      currency: contract?.currency ?? currency,
      cashGrossPay,
      nonCashBenefits: [],
      allowableDeductions: [],
      otherDeductions: [],
      taxResidencyStatus: "RESIDENT",
      rules,
    });
  }
}
