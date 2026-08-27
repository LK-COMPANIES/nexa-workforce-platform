import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { inviteMemberSchema, type InviteMemberInput } from "@nexa/validation";
import type { Request } from "express";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { AuthService } from "../auth/auth.service";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { extractRequestMetadata } from "../common/request-metadata.util";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { PrismaService } from "../prisma/prisma.service";

// Thin, real end-to-end proof of the tenant-context + RLS + RBAC pattern.
// Full organization CRUD (role/permission management, cross-tenant
// listing for platform super-admins) is intentionally deferred — the
// latter needs its own carefully audited elevated-access path, not a
// shortcut bolted onto this controller. Admin-driven invite-by-token
// (Phase 6) is implemented below — see AuthService.inviteMember/
// acceptInvite for why the identity-creation logic lives there.
@Controller("organizations")
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

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

  // Returns a one-time invite token the admin must deliver to the invitee
  // out of band (Slack, email client, in person) — no email-sending
  // infrastructure exists in this system. See AuthService.inviteMember's
  // own comment for why this can't grant "nexa_super_admin" and for the
  // RLS mechanics of creating a membership (and possibly a user) that
  // isn't the calling admin's own.
  @Post("members/invite")
  @RequirePermission("organization:manage_members")
  inviteMember(
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput,
    @CurrentTenant() tenant: RequestTenantContext,
    @Req() request: Request,
  ) {
    return this.authService.inviteMember(tenant, body, extractRequestMetadata(request));
  }
}
