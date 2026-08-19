import { ForbiddenException, Injectable } from "@nestjs/common";
import type { Prisma, PayrollRecord, PayrollRun, StatutoryRuleType } from "@prisma/client";
import { calculateKenyaPayroll, PAYROLL_ENGINE_VERSION, type PayrollCalculationResult } from "@nexa/payroll-engine";
import type { CreatePayrollRunInput, PayrollCalculatorInput } from "@nexa/validation";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestTenantContext } from "../tenancy/types";
import { PayrollCalculationService } from "./payroll-calculation.service";
import { assertValidPayrollTransition } from "./payroll-run-lifecycle";
import { PayrollRepository } from "./payroll.repository";
import { StatutoryRulesLoader } from "./statutory-rules.loader";

// Calculation-transaction timeout. Bulk payroll calculation genuinely does
// more work than Prisma's 5s interactive-transaction default anticipates —
// see the scaling note below.
const CALCULATION_TRANSACTION_TIMEOUT_MS = 30_000;

// Documented scaling boundary: this implementation processes an entire
// organization's payroll run inside ONE Postgres transaction, which is what
// gives it atomicity (brief §18 — all-or-nothing, never a partially-saved
// run reported as successful) essentially for free. That is the right
// tradeoff for the organization sizes this foundation targets. Past some
// employee count, a single transaction stops being viable regardless of
// timeout (lock contention, memory, the 30s ceiling above). The next
// evolution — not built here — is a saga/outbox pattern: a run enters
// CALCULATING, chunks of employees are processed in their own short
// transactions with idempotent per-chunk markers, and the run only reaches
// CALCULATED once every chunk has committed. That is materially more
// complex and was not warranted for Phase 3's foundation.
function zeroTotals() {
  return {
    employeeCount: 0,
    grossTotal: 0,
    taxablePayTotal: 0,
    payeTotal: 0,
    nssfEmployeeTotal: 0,
    nssfEmployerTotal: 0,
    shifTotal: 0,
    housingLevyEmployeeTotal: 0,
    housingLevyEmployerTotal: 0,
    otherDeductionsTotal: 0,
    netPayrollTotal: 0,
    totalEmploymentCost: 0,
  };
}

function accumulate(totals: ReturnType<typeof zeroTotals>, result: PayrollCalculationResult) {
  return {
    employeeCount: totals.employeeCount + 1,
    grossTotal: totals.grossTotal + result.grossPay,
    taxablePayTotal: totals.taxablePayTotal + result.taxablePay,
    payeTotal: totals.payeTotal + result.paye,
    nssfEmployeeTotal: totals.nssfEmployeeTotal + result.nssfEmployeeTotal,
    nssfEmployerTotal: totals.nssfEmployerTotal + result.nssfEmployerTotal,
    shifTotal: totals.shifTotal + result.shifEmployee,
    housingLevyEmployeeTotal: totals.housingLevyEmployeeTotal + result.housingLevyEmployee,
    housingLevyEmployerTotal: totals.housingLevyEmployerTotal + result.housingLevyEmployer,
    otherDeductionsTotal: totals.otherDeductionsTotal + result.otherDeductionsTotal,
    netPayrollTotal: totals.netPayrollTotal + result.netPay,
    totalEmploymentCost: totals.totalEmploymentCost + result.totalEmploymentCost,
  };
}

function mapResultToRecordData(
  result: PayrollCalculationResult,
  context: { organizationId: string; payrollRunId: string; contractId: string | null; periodStart: Date; periodEnd: Date },
): Prisma.PayrollRecordUncheckedCreateInput {
  return {
    organizationId: context.organizationId,
    employeeId: result.employeeId,
    contractId: context.contractId,
    payrollRunId: context.payrollRunId,
    payrollPeriodStart: context.periodStart,
    payrollPeriodEnd: context.periodEnd,
    currency: result.currency,
    grossPay: result.grossPay,
    cashPay: result.cashPay,
    nonCashBenefits: result.nonCashBenefits,
    taxableBenefits: result.taxableBenefits,
    taxableIncome: result.totalEmploymentIncome,
    payeBeforeRelief: result.payeBeforeRelief,
    personalRelief: result.personalRelief,
    otherReliefs: result.otherReliefs,
    payeAmount: result.paye,
    nssfEmployeeAmount: result.nssfEmployeeTotal,
    nssfEmployerAmount: result.nssfEmployerTotal,
    shifAmount: result.shifEmployee,
    housingLevyEmployeeAmount: result.housingLevyEmployee,
    housingLevyEmployerAmount: result.housingLevyEmployer,
    allowableDeductions: result.allowableDeductionsTotal > 0 ? { total: result.allowableDeductionsTotal } : undefined,
    otherDeductions: result.otherDeductionsTotal > 0 ? { total: result.otherDeductionsTotal } : undefined,
    totalEmployeeDeductions: result.totalEmployeeDeductions,
    employerStatutoryCost: result.employerStatutoryCost,
    netPay: result.netPay,
    totalEmploymentCost: result.totalEmploymentCost,
    effectiveTaxRate: result.effectiveTaxRate,
    calculationSteps: result.calculationSteps as unknown as Prisma.InputJsonValue,
    engineVersion: result.engineVersion,
  };
}

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PayrollRepository,
    private readonly rulesLoader: StatutoryRulesLoader,
    private readonly calculationService: PayrollCalculationService,
  ) {}

  // Ad-hoc "what-if" calculation (brief §14) — reuses the exact same pure
  // engine and active statutory rules as a real payroll run, but persists
  // NOTHING. Still runs inside runWithTenant(): loading which statutory
  // rules apply is itself a tenant-scoped read (today only KE, but the
  // rules loader is jurisdiction-aware), and this keeps the operation
  // consistent with every other tenant-scoped code path even though there's
  // no write. The frontend calculator MUST call this — brief §14 explicitly
  // forbids reimplementing PAYE/NSSF/SHIF/Housing Levy in React.
  async calculatePreview(
    tenant: RequestTenantContext,
    input: PayrollCalculatorInput,
  ): Promise<PayrollCalculationResult> {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const { rules } = await this.rulesLoader.loadActiveKenyaRules(tx, input.payrollPeriodStart);
      return calculateKenyaPayroll({
        employeeId: randomUUID(),
        period: {
          start: input.payrollPeriodStart.toISOString().slice(0, 10),
          end: input.payrollPeriodEnd.toISOString().slice(0, 10),
        },
        currency: input.currency,
        cashGrossPay: input.cashGrossPay,
        nonCashBenefits: input.nonCashBenefits,
        allowableDeductions: input.allowableDeductions,
        otherDeductions: input.otherDeductions,
        taxResidencyStatus: "RESIDENT",
        rules,
      });
    });
  }

  async createRun(tenant: RequestTenantContext, input: CreatePayrollRunInput): Promise<PayrollRun> {
    // The DB unique constraint (organizationId, payrollPeriodStart,
    // payrollPeriodEnd, runType) is the actual idempotency guarantee (brief
    // §21) — PayrollRepository.createRun() catches the P2002 violation and
    // raises a proper 409 ConflictException, not a raw 500.
    return this.repository.createRun(tenant, input);
  }

  async listRuns(tenant: RequestTenantContext): Promise<PayrollRun[]> {
    return this.repository.listRuns(tenant);
  }

  async getRun(tenant: RequestTenantContext, runId: string): Promise<PayrollRun> {
    return this.repository.getRunOrThrow(tenant, runId);
  }

  async getRunRecords(tenant: RequestTenantContext, runId: string): Promise<PayrollRecord[]> {
    return this.repository.getRunRecords(tenant, runId);
  }

  async calculate(tenant: RequestTenantContext, runId: string): Promise<PayrollRun> {
    const tenantContext = { tenantId: tenant.organizationId, userId: tenant.userId };

    const startingRun = await this.repository.getRunOrThrow(tenant, runId);
    assertValidPayrollTransition(startingRun.status, "CALCULATING");
    await this.prisma.runWithTenant(tenantContext, (tx) =>
      tx.payrollRun.update({ where: { id: runId }, data: { status: "CALCULATING", failureReason: null } }),
    );

    try {
      await this.prisma.runWithTenant(
        tenantContext,
        async (tx) => {
          const run = await tx.payrollRun.findUniqueOrThrow({ where: { id: runId } });
          const { rules, ruleVersionIds } = await this.rulesLoader.loadActiveKenyaRules(
            tx,
            run.payrollPeriodStart,
          );

          const ruleTypeEntries = Object.entries(ruleVersionIds) as [StatutoryRuleType, string][];
          for (const [ruleType, statutoryRuleVersionId] of ruleTypeEntries) {
            await tx.payrollRunStatutoryRule.upsert({
              where: { payrollRunId_ruleType: { payrollRunId: run.id, ruleType } },
              update: { statutoryRuleVersionId },
              create: { payrollRunId: run.id, ruleType, statutoryRuleVersionId },
            });
          }

          const employees = await this.repository.listEligibleEmployeesWithActiveContract(
            tx,
            tenant.organizationId,
          );

          let totals = zeroTotals();
          for (const employee of employees) {
            const contract = employee.contracts[0] ?? null;
            const result = this.calculationService.calculateForEmployee(
              employee,
              contract,
              rules,
              { start: run.payrollPeriodStart, end: run.payrollPeriodEnd },
              run.currency,
            );

            const recordData = mapResultToRecordData(result, {
              organizationId: tenant.organizationId,
              payrollRunId: run.id,
              contractId: contract?.id ?? null,
              periodStart: run.payrollPeriodStart,
              periodEnd: run.payrollPeriodEnd,
            });

            await tx.payrollRecord.upsert({
              where: { payrollRunId_employeeId: { payrollRunId: run.id, employeeId: employee.id } },
              update: recordData,
              create: recordData,
            });

            totals = accumulate(totals, result);
          }

          await tx.payrollRun.update({
            where: { id: run.id },
            data: { status: "CALCULATED", engineVersion: PAYROLL_ENGINE_VERSION, ...totals },
          });
        },
        { timeout: CALCULATION_TRANSACTION_TIMEOUT_MS },
      );
    } catch (error) {
      // Deliberately a SEPARATE transaction: if the block above rolled back
      // (partial calculation never persisted — atomicity preserved), this
      // still needs to commit the FAILED status so the run isn't left
      // stuck in CALCULATING forever.
      const failureReason = error instanceof Error ? error.message.slice(0, 500) : "Unknown error";
      await this.prisma.runWithTenant(tenantContext, (tx) =>
        tx.payrollRun.update({ where: { id: runId }, data: { status: "FAILED", failureReason } }),
      );
      throw error;
    }

    return this.repository.getRunOrThrow(tenant, runId);
  }

  async approve(tenant: RequestTenantContext, runId: string): Promise<PayrollRun> {
    const tenantContext = { tenantId: tenant.organizationId, userId: tenant.userId };
    const run = await this.repository.getRunOrThrow(tenant, runId);
    assertValidPayrollTransition(run.status, "APPROVED");

    return this.prisma.runWithTenant(tenantContext, (tx) =>
      tx.payrollRun.update({
        where: { id: runId },
        data: { status: "APPROVED", approvedByUserId: tenant.userId, approvedAt: new Date() },
      }),
    );
  }

  async finalize(tenant: RequestTenantContext, runId: string): Promise<PayrollRun> {
    const tenantContext = { tenantId: tenant.organizationId, userId: tenant.userId };
    const run = await this.repository.getRunOrThrow(tenant, runId);
    assertValidPayrollTransition(run.status, "FINALIZED");

    return this.prisma.runWithTenant(tenantContext, (tx) =>
      tx.payrollRun.update({
        where: { id: runId },
        data: { status: "FINALIZED", finalizedAt: new Date() },
      }),
    );
  }

  async voidRun(tenant: RequestTenantContext, runId: string, reason: string): Promise<PayrollRun> {
    const tenantContext = { tenantId: tenant.organizationId, userId: tenant.userId };
    const run = await this.repository.getRunOrThrow(tenant, runId);
    if (run.status === "FINALIZED") {
      // Brief §20: a finalized payroll must never be silently
      // recalculated/overwritten — voiding a FINALIZED run is deliberately
      // not permitted either; a correction is a new CORRECTION-type run.
      throw new ForbiddenException(
        "A FINALIZED payroll run cannot be voided. Create a CORRECTION run instead.",
      );
    }
    assertValidPayrollTransition(run.status, "VOIDED");

    return this.prisma.runWithTenant(tenantContext, (tx) =>
      tx.payrollRun.update({
        where: { id: runId },
        data: { status: "VOIDED", voidedAt: new Date(), voidedReason: reason },
      }),
    );
  }
}
