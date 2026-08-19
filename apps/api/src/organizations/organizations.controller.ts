import { Controller, Get, UseGuards } from "@nestjs/common";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { PrismaService } from "../prisma/prisma.service";

// Thin, real end-to-end proof of the tenant-context + RLS + RBAC pattern.
// Full organization CRUD (admin-driven onboarding, invite-by-email,
// role/permission management) is intentionally deferred — see
// docs/architecture.md. Cross-tenant listing for platform super-admins is
// deliberately NOT implemented here either: it needs its own carefully
// audited elevated-access path, not a shortcut bolted onto this controller.
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

  // Members of the CURRENT tenant only — a normal organization_id-scoped
  // read, no new RLS bypass needed (unlike auth/memberships, which spans
  // every org a user belongs to).
  @Get("members")
  @RequirePermission("organization:manage_members")
  async listMembers(@CurrentTenant() tenant: RequestTenantContext) {
    const memberships = await this.prisma.runWithTenant(
      { tenantId: tenant.organizationId, userId: tenant.userId },
      (tx) =>
        tx.organizationMembership.findMany({
          where: { organizationId: tenant.organizationId },
          include: {
            role: true,
            user: { select: { id: true, email: true, firstName: true, lastName: true, isActive: true, lastLoginAt: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
    );

    return memberships.map((membership) => ({
      id: membership.id,
      status: membership.status,
      joinedAt: membership.joinedAt,
      role: { key: membership.role.key, name: membership.role.name },
      user: membership.user,
    }));
  }
}
