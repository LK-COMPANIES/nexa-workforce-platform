import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";

// Minimal, real read surface for the Employee model (existed since Phase 1,
// never exposed via an endpoint). Added in Phase 4 because the executive
// dashboard's "Total Workforce" metric (brief §9) needs a genuine data
// source — the alternative would be fabricating a number, which brief §9's
// own rule ("no fabricated dashboard metrics") forbids.
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
}
