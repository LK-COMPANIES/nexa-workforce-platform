import { Body, ConflictException, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createEmployeeSchema, type CreateEmployeeInput } from "@nexa/validation";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";

// Minimal, real read/write surface for the Employee model (existed since
// Phase 1; read-only until Phase 5, when it became the base of the
// mandatory E2E critical path — employee creation has to happen somewhere
// real for contract/payroll E2E tests to build on, and the brief's own
// instruction is to test through the authenticated API layer rather than
// bypass it, so this is that layer, not a workaround for one that already
// existed. The executive dashboard's "Total Workforce" metric (brief §9,
// Phase 4) already depends on `list()`.
@Controller("employees")
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class EmployeesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermission("employee:read")
  list(@CurrentTenant() tenant: RequestTenantContext) {
    return this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, (tx) =>
      tx.employee.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  @Post()
  @RequirePermission("employee:create")
  async create(
    @Body(new ZodValidationPipe(createEmployeeSchema)) body: CreateEmployeeInput,
    @CurrentTenant() tenant: RequestTenantContext,
  ) {
    try {
      return await this.prisma.runWithTenant({ tenantId: tenant.organizationId, userId: tenant.userId }, (tx) =>
        tx.employee.create({
          data: { ...body, organizationId: tenant.organizationId },
        }),
      );
    } catch (error) {
      // organizationId+employeeNumber is a real unique constraint
      // (schema.prisma) — the global exception filter only special-cases
      // HttpException, not a raw Prisma error, so this must be translated
      // explicitly (same pattern as PayrollRepository.createRun, Phase 3).
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("An employee with this employee number already exists in this organization.");
      }
      throw error;
    }
  }
}
