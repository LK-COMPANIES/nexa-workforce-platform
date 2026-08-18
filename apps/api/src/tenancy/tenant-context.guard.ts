import { CanActivate, type ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { PermissionKey } from "@nexa/types";
import type { Prisma } from "@prisma/client";
import type { Request } from "express";
import { AuthAuditService } from "../auth/auth-audit.service";
import { extractRequestMetadata } from "../common/request-metadata.util";
import { PrismaService } from "../prisma/prisma.service";
import type { RequestTenantContext } from "./types";

type RejectReason = "SESSION_REVOKED" | "ACCOUNT_DISABLED" | "TENANT_ACCESS_DENIED";

class SessionRejectedError extends Error {
  constructor(public readonly reason: RejectReason) {
    super(reason);
  }
}

interface ResolvedAuthorization {
  roleKey: string;
  permissions: PermissionKey[];
  isSuperAdminSession: boolean;
}

// The heart of Phase 2's tenant-isolation guarantee. Runs AFTER JwtAuthGuard
// (which only proves "this token was validly signed for this user/org/
// session"). This guard re-derives authorization from the database, live,
// on every single request:
//   - the session named in the token still exists, is ACTIVE, unexpired,
//     and matches the token's (userId, organizationId)
//   - the user is still active
//   - either the user is a platform super-admin (isSuperAdminSession) OR
//     they hold a live ACTIVE OrganizationMembership in this organization
//   - the permissions attached to the request are read fresh from that
//     membership's role, never from the token
//
// The entire check runs inside runWithTenant() — i.e. inside a transaction
// with Postgres RLS's app.current_tenant_id set to the token's claimed
// organization_id. If that claim is wrong or stale, RLS itself returns zero
// rows for the session/membership lookups, so this fails closed even if the
// application-layer logic below had a bug. Every failure path is audited.
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuthAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { tenantContext?: RequestTenantContext }>();
    const claims = request.tenantContext;
    if (!claims) {
      throw new UnauthorizedException("Missing authentication context");
    }

    try {
      const resolved = await this.prisma.runWithTenant(
        { tenantId: claims.organizationId, userId: claims.userId },
        (tx) => this.resolveAuthorization(tx, claims),
      );

      request.tenantContext = {
        ...claims,
        roleKey: resolved.roleKey,
        permissions: resolved.permissions,
        isSuperAdminSession: resolved.isSuperAdminSession,
      };
      return true;
    } catch (error) {
      const reason = error instanceof SessionRejectedError ? error.reason : "TENANT_ACCESS_DENIED";
      await this.auditService.record({
        organizationId: claims.organizationId,
        actingUserId: claims.userId,
        sessionId: claims.sessionId,
        eventType: reason,
        meta: extractRequestMetadata(request),
      });

      if (reason === "ACCOUNT_DISABLED") {
        throw new ForbiddenException("Account disabled");
      }
      throw new UnauthorizedException("Session is no longer valid");
    }
  }

  private async resolveAuthorization(
    tx: Prisma.TransactionClient,
    claims: RequestTenantContext,
  ): Promise<ResolvedAuthorization> {
    const session = await tx.session.findUnique({ where: { id: claims.sessionId } });
    if (
      !session ||
      session.userId !== claims.userId ||
      session.organizationId !== claims.organizationId ||
      session.status !== "ACTIVE" ||
      session.expiresAt.getTime() <= Date.now()
    ) {
      throw new SessionRejectedError("SESSION_REVOKED");
    }

    const user = await tx.user.findUnique({ where: { id: claims.userId } });
    if (!user) {
      throw new SessionRejectedError("TENANT_ACCESS_DENIED");
    }
    if (!user.isActive) {
      throw new SessionRejectedError("ACCOUNT_DISABLED");
    }

    if (session.isSuperAdminSession) {
      if (!user.isPlatformSuperAdmin) {
        // Defense in depth: a session flagged super-admin whose user is no
        // longer one (e.g. the flag was revoked after the session was
        // issued) must not retain elevated access.
        throw new SessionRejectedError("TENANT_ACCESS_DENIED");
      }
      const role = await tx.role.findUnique({
        where: { key: "nexa_super_admin" },
        include: { permissions: { include: { permission: true } } },
      });
      if (!role) {
        throw new SessionRejectedError("TENANT_ACCESS_DENIED");
      }
      await tx.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });
      return {
        roleKey: role.key,
        permissions: role.permissions.map((rp) => rp.permission.key) as PermissionKey[],
        isSuperAdminSession: true,
      };
    }

    const membership = await tx.organizationMembership.findFirst({
      where: { userId: claims.userId, organizationId: claims.organizationId, status: "ACTIVE" },
      include: { role: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!membership) {
      throw new SessionRejectedError("TENANT_ACCESS_DENIED");
    }

    await tx.session.update({ where: { id: session.id }, data: { lastUsedAt: new Date() } });

    return {
      roleKey: membership.role.key,
      permissions: membership.role.permissions.map((rp) => rp.permission.key) as PermissionKey[],
      isSuperAdminSession: false,
    };
  }
}
