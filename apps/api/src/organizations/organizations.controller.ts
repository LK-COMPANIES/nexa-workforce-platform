import { Controller, Get, UseGuards } from "@nestjs/common";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { PrismaService } from "../prisma/prisma.service";

// Thin, real end-to-end proof of the tenant-context + RLS + RBAC pattern.
// Full organization/employee/contract/payroll CRUD is intentionally deferred
// past Phase 2 — see docs/architecture.md.
@Controller("organizations")
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("me")
  @RequirePermission("organization:read")
  getCurrentOrganization(@CurrentTenant() tenant: RequestTenantContext) {
    return this.prisma.runWithTenant(
      { tenantId: tenant.organizationId, userId: tenant.userId },
      (tx) => tx.organization.findUniqueOrThrow({ where: { id: tenant.organizationId } }),
    );
  }
}
