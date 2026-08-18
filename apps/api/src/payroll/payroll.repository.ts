import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestTenantContext } from "../tenancy/types";
import type { CreatePayrollRunInput } from "@nexa/validation";

// All cross-tenant-boundary lookups go through runWithTenant()/RLS — a
// payrollRunId belonging to another organization is simply invisible here,
// never a distinguishable "exists but forbidden" response (brief §35: never
// trust an id from the URL without verifying scope through tenant context).
@Injectable()
export class PayrollRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(tenant: RequestTenantContext, input: CreatePayrollRunInput) {
    try {
      return await this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, (tx) =>
        tx.payrollRun.create({
          data: {
            organizationId: tenant.organizationId,
            runType: input.runType,
            currency: input.currency,
            payrollPeriodStart: input.payrollPeriodStart,
            payrollPeriodEnd: input.payrollPeriodEnd,
            createdByUserId: tenant.userId,
            status: "DRAFT",
          },
        }),
      );
    } catch (error) {
      // The DB unique constraint (organizationId, payrollPeriodStart,
      // payrollPeriodEnd, runType) is the real idempotency guarantee (brief
      // §21) — surface its violation as a clear 409, not a generic 500.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException(
          "A payroll run of this type already exists for this organization and period.",
        );
      }
      throw error;
    }
  }

  async getRunOrThrow(tenant: RequestTenantContext, runId: string) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runId } });
      if (!run) {
        throw new NotFoundException("Payroll run not found");
      }
      return run;
    });
  }

  async listRuns(tenant: RequestTenantContext) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, (tx) =>
      tx.payrollRun.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { payrollPeriodStart: "desc" },
      }),
    );
  }

  async getRunRecords(tenant: RequestTenantContext, runId: string) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runId } });
      if (!run) {
        throw new NotFoundException("Payroll run not found");
      }
      return tx.payrollRecord.findMany({
        where: { payrollRunId: runId },
        orderBy: { createdAt: "asc" },
      });
    });
  }

  /** Must be called with a `tx` already scoped via runWithTenant(). */
  async listEligibleEmployeesWithActiveContract(tx: Prisma.TransactionClient, organizationId: string) {
    return tx.employee.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: {
        contracts: {
          where: { status: "ACTIVE" },
          orderBy: { effectiveDate: "desc" },
          take: 1,
        },
      },
    });
  }
}
