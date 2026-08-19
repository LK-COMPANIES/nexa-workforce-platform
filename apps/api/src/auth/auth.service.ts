import { Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  assertPasswordPolicy,
  hashPassword,
  hashRefreshToken,
  signAccessToken,
  verifyPassword,
  type TokenIssuerConfig,
} from "@nexa/auth";
import type { PermissionKey } from "@nexa/types";
import type {
  LoginInput,
  RegisterClientOrganizationInput,
} from "@nexa/validation";
import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { ApiConfigService } from "../config/config.service";
import type { RequestMetadata } from "../common/request-metadata.util";
import type { RequestTenantContext } from "../tenancy/types";
import { PrismaService } from "../prisma/prisma.service";
import { AuthAuditService } from "./auth-audit.service";
import { RefreshTokenService } from "./refresh-token.service";
import { SessionService } from "./session.service";

export type { RequestMetadata } from "../common/request-metadata.util";

interface AuthLookupRow {
  id: string;
  email: string;
  password_hash: string;
  is_active: boolean;
  is_platform_super_admin: boolean;
}

interface MembershipLookupRow {
  organization_id: string;
  organization_display_name: string;
  organization_type: string;
  role_key: string;
  role_name: string;
  membership_status: string;
}

interface RefreshLookupRow {
  refresh_token_id: string;
  family_id: string;
  refresh_token_status: string;
  refresh_token_expires_at: Date;
  session_id: string;
  session_status: string;
  session_expires_at: Date;
  is_super_admin_session: boolean;
  user_id: string;
  organization_id: string;
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

@Injectable()
export class AuthService {
  private readonly tokenIssuerConfig: TokenIssuerConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ApiConfigService,
    private readonly sessionService: SessionService,
    private readonly refreshTokenService: RefreshTokenService,
    private readonly auditService: AuthAuditService,
  ) {
    this.tokenIssuerConfig = {
      secret: this.config.env.JWT_ACCESS_SECRET,
      issuer: this.config.env.JWT_ISSUER,
      audience: this.config.env.JWT_AUDIENCE,
    };
  }

  // ---------------------------------------------------------------------------
  // Registration = client-organization onboarding. Creates a new CLIENT
  // Organization, its first User, and a Client_Admin OrganizationMembership,
  // atomically. Public registration can NEVER produce a NEXA_SUPER_ADMIN or
  // any platform role — client_admin is the only role this path can grant,
  // hard-coded here rather than accepted from the request body.
  //
  // Neither the new organization nor the new user exist yet, so there is no
  // pre-existing tenant context to inherit — this mints their ids up front
  // and establishes RLS context using those chosen ids BEFORE inserting,
  // exactly like packages/database/prisma/seed.ts does for the Nexa root
  // organization. Every insert below therefore satisfies RLS's WITH CHECK
  // naturally; no bypass is used or needed.
  // ---------------------------------------------------------------------------
  async register(input: RegisterClientOrganizationInput, meta: RequestMetadata) {
    assertPasswordPolicy(input.admin.password);

    const existingRows = await this.prisma.client.$queryRaw<AuthLookupRow[]>`
      SELECT * FROM auth_lookup_user_by_email(${input.admin.email})
    `;
    if (existingRows.length > 0) {
      throw new UnauthorizedException("Registration failed"); // deliberately generic; see auth.controller.ts
    }

    const organizationId = randomUUID();
    const userId = randomUUID();
    const passwordHash = await hashPassword(input.admin.password);

    let result: { organization: { id: string; displayName: string }; user: { id: string; email: string } };
    try {
      result = await this.prisma.runWithTenant(
        { tenantId: organizationId, userId },
        async (tx) => {
          const organization = await tx.organization.create({
            data: {
              id: organizationId,
              type: "CLIENT",
              legalName: input.organization.legalName,
              displayName: input.organization.displayName,
              countryCode: input.organization.countryCode,
              taxIdentifier: input.organization.taxIdentifier,
            },
          });

          const user = await tx.user.create({
            data: {
              id: userId,
              email: input.admin.email,
              passwordHash,
              firstName: input.admin.firstName,
              lastName: input.admin.lastName,
              phone: input.admin.phone,
            },
          });

          const clientAdminRole = await tx.role.findUniqueOrThrow({ where: { key: "client_admin" } });

          await tx.organizationMembership.create({
            data: {
              userId: user.id,
              organizationId: organization.id,
              roleId: clientAdminRole.id,
              status: "ACTIVE",
              joinedAt: new Date(),
            },
          });

          await tx.authenticationAuditEvent.create({
            data: {
              organizationId: organization.id,
              actingUserId: user.id,
              eventType: "REGISTRATION",
              ipAddress: meta.ip,
              userAgent: meta.userAgent?.slice(0, 512),
            },
          });

          return { organization, user };
        },
      );
    } catch (error) {
      // Narrow TOCTOU window: the existence check above and this INSERT are
      // not atomic, so a concurrent registration for the same email can
      // still race past it. Prisma surfaces that as a unique-constraint
      // violation (P2002) — translate it to the same generic failure rather
      // than letting a raw ORM error reach the caller.
      if (isUniqueConstraintViolation(error)) {
        throw new UnauthorizedException("Registration failed");
      }
      throw error;
    }

    return {
      organization: { id: result.organization.id, displayName: result.organization.displayName },
      user: { id: result.user.id, email: result.user.email },
    };
  }

  // ---------------------------------------------------------------------------
  // Login. Every failure path throws the SAME generic UnauthorizedException —
  // unknown email, wrong password, inactive account, and "not a member of
  // this organization" are indistinguishable to the caller (avoids account
  // enumeration), while the specific reason is still captured in the
  // LOGIN_FAILURE audit event's metadata for investigation.
  // ---------------------------------------------------------------------------
  async login(input: LoginInput, meta: RequestMetadata) {
    const genericFailure = () => new UnauthorizedException("Invalid credentials");

    const rows = await this.prisma.client.$queryRaw<AuthLookupRow[]>`
      SELECT * FROM auth_lookup_user_by_email(${input.email})
    `;
    const row = rows[0];

    if (!row || !row.is_active) {
      await this.auditService.record({
        organizationId: input.organizationId,
        actingUserId: row?.id ?? null,
        eventType: "LOGIN_FAILURE",
        meta,
        metadata: { reason: row ? "account_inactive" : "unknown_email" },
      });
      throw genericFailure();
    }

    const passwordValid = await verifyPassword(input.password, row.password_hash);
    if (!passwordValid) {
      await this.auditService.record({
        organizationId: input.organizationId,
        actingUserId: row.id,
        eventType: "LOGIN_FAILURE",
        meta,
        metadata: { reason: "invalid_password" },
      });
      throw genericFailure();
    }

    const result = await this.prisma.runWithTenant(
      { tenantId: input.organizationId, userId: row.id },
      async (tx) => {
        let roleKey: string;
        let permissions: PermissionKey[];
        let isSuperAdminSession = false;

        if (row.is_platform_super_admin) {
          const role = await tx.role.findUniqueOrThrow({
            where: { key: "nexa_super_admin" },
            include: { permissions: { include: { permission: true } } },
          });
          roleKey = role.key;
          permissions = role.permissions.map((rp) => rp.permission.key) as PermissionKey[];
          isSuperAdminSession = true;
        } else {
          const membership = await tx.organizationMembership.findFirst({
            where: { userId: row.id, organizationId: input.organizationId, status: "ACTIVE" },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          });
          if (!membership) {
            return null;
          }
          roleKey = membership.role.key;
          permissions = membership.role.permissions.map((rp) => rp.permission.key) as PermissionKey[];
        }

        const session = await this.sessionService.createSession(tx, {
          userId: row.id,
          organizationId: input.organizationId,
          isSuperAdminSession,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
        const { raw: refreshToken } = await this.refreshTokenService.issueInitial(tx, session.id);

        const accessToken = signAccessToken(
          {
            sub: row.id,
            organization_id: input.organizationId,
            session_id: session.id,
            role_key: roleKey,
            token_type: "access",
          },
          this.tokenIssuerConfig,
          this.config.env.JWT_ACCESS_TTL,
        );

        await tx.user.update({ where: { id: row.id }, data: { lastLoginAt: new Date() } });

        await tx.authenticationAuditEvent.create({
          data: {
            organizationId: input.organizationId,
            actingUserId: row.id,
            sessionId: session.id,
            eventType: "LOGIN_SUCCESS",
            ipAddress: meta.ip,
            userAgent: meta.userAgent?.slice(0, 512),
          },
        });
        if (isSuperAdminSession) {
          await tx.authenticationAuditEvent.create({
            data: {
              organizationId: input.organizationId,
              actingUserId: row.id,
              sessionId: session.id,
              eventType: "SUPER_ADMIN_ORG_ACCESS",
              ipAddress: meta.ip,
              userAgent: meta.userAgent?.slice(0, 512),
              metadata: { note: "session established without an OrganizationMembership row" },
            },
          });
        }

        return { accessToken, refreshToken, roleKey, permissions };
      },
    );

    if (!result) {
      await this.auditService.record({
        organizationId: input.organizationId,
        actingUserId: row.id,
        eventType: "LOGIN_FAILURE",
        meta,
        metadata: { reason: "no_active_membership" },
      });
      throw genericFailure();
    }

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: { id: row.id, email: row.email },
      tenant: { organizationId: input.organizationId, roleKey: result.roleKey, permissions: result.permissions },
    };
  }

  // ---------------------------------------------------------------------------
  // Refresh rotation with reuse detection. A token whose status is anything
  // other than ACTIVE being presented again means it was already consumed
  // (by the legitimate client rotating past it, or by us revoking it) — an
  // attacker replaying a captured token is exactly this shape, so it is
  // treated as theft: the WHOLE family and its session are revoked, forcing
  // fresh authentication, not just this one token.
  // ---------------------------------------------------------------------------
  async refresh(rawToken: string, meta: RequestMetadata) {
    const tokenHash = hashRefreshToken(rawToken);
    const rows = await this.prisma.client.$queryRaw<RefreshLookupRow[]>`
      SELECT * FROM auth_lookup_refresh_token(${tokenHash})
    `;
    const row = rows[0];
    if (!row) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (row.refresh_token_status !== "ACTIVE") {
      await this.prisma.runWithTenant(
        { tenantId: row.organization_id, userId: row.user_id },
        async (tx) => {
          await tx.refreshToken.updateMany({
            where: { familyId: row.family_id, status: "ACTIVE" },
            data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "REUSE_DETECTED" },
          });
          await tx.session.update({
            where: { id: row.session_id },
            data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "REUSE_DETECTED" },
          });
          await tx.authenticationAuditEvent.create({
            data: {
              organizationId: row.organization_id,
              actingUserId: row.user_id,
              sessionId: row.session_id,
              eventType: "REFRESH_REUSE_DETECTED",
              ipAddress: meta.ip,
              userAgent: meta.userAgent?.slice(0, 512),
            },
          });
        },
      );
      throw new UnauthorizedException("Refresh token reuse detected — session revoked");
    }

    if (
      row.refresh_token_expires_at.getTime() <= Date.now() ||
      row.session_status !== "ACTIVE" ||
      row.session_expires_at.getTime() <= Date.now()
    ) {
      throw new UnauthorizedException("Refresh token or session expired");
    }

    return this.prisma.runWithTenant(
      { tenantId: row.organization_id, userId: row.user_id },
      async (tx) => {
        let roleKey: string;
        let permissions: PermissionKey[];

        if (row.is_super_admin_session) {
          const role = await tx.role.findUniqueOrThrow({
            where: { key: "nexa_super_admin" },
            include: { permissions: { include: { permission: true } } },
          });
          roleKey = role.key;
          permissions = role.permissions.map((rp) => rp.permission.key) as PermissionKey[];
        } else {
          const membership = await tx.organizationMembership.findFirst({
            where: { userId: row.user_id, organizationId: row.organization_id, status: "ACTIVE" },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          });
          if (!membership) {
            throw new UnauthorizedException("Membership is no longer active");
          }
          roleKey = membership.role.key;
          permissions = membership.role.permissions.map((rp) => rp.permission.key) as PermissionKey[];
        }

        // Rotate: the presented token is retired, a new one takes its place
        // in the same family.
        await tx.refreshToken.update({
          where: { id: row.refresh_token_id },
          data: { status: "ROTATED", rotatedAt: new Date() },
        });
        const { raw: newRefreshToken } = await this.refreshTokenService.issue(
          tx,
          row.session_id,
          row.family_id,
        );

        const accessToken = signAccessToken(
          {
            sub: row.user_id,
            organization_id: row.organization_id,
            session_id: row.session_id,
            role_key: roleKey,
            token_type: "access",
          },
          this.tokenIssuerConfig,
          this.config.env.JWT_ACCESS_TTL,
        );

        await tx.session.update({ where: { id: row.session_id }, data: { lastUsedAt: new Date() } });
        await tx.authenticationAuditEvent.create({
          data: {
            organizationId: row.organization_id,
            actingUserId: row.user_id,
            sessionId: row.session_id,
            eventType: "REFRESH",
            ipAddress: meta.ip,
            userAgent: meta.userAgent?.slice(0, 512),
          },
        });

        return {
          accessToken,
          refreshToken: newRefreshToken,
          tenant: { organizationId: row.organization_id, roleKey, permissions },
        };
      },
    );
  }

  async logout(tenant: RequestTenantContext, meta: RequestMetadata): Promise<void> {
    await this.prisma.runWithTenant(
      { tenantId: tenant.organizationId, userId: tenant.userId },
      async (tx) => {
        await tx.session.update({
          where: { id: tenant.sessionId },
          data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "LOGOUT" },
        });
        await tx.refreshToken.updateMany({
          where: { sessionId: tenant.sessionId, status: "ACTIVE" },
          data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "LOGOUT" },
        });
        await tx.authenticationAuditEvent.create({
          data: {
            organizationId: tenant.organizationId,
            actingUserId: tenant.userId,
            sessionId: tenant.sessionId,
            eventType: "LOGOUT",
            ipAddress: meta.ip,
            userAgent: meta.userAgent?.slice(0, 512),
          },
        });
      },
    );
  }

  // Admin-initiated revocation of an ARBITRARY session (not necessarily the
  // caller's own) — e.g. an admin force-logging-out a compromised account.
  // The target session's tenant scope is enforced by RLS: a sessionId
  // belonging to another organization simply isn't visible inside this
  // runWithTenant() block, so it 404s rather than leaking cross-tenant
  // existence. Gated by the "user:disable" permission at the controller.
  async revokeSession(
    tenant: RequestTenantContext,
    targetSessionId: string,
    meta: RequestMetadata,
  ): Promise<void> {
    await this.prisma.runWithTenant(
      { tenantId: tenant.organizationId, userId: tenant.userId },
      async (tx) => {
        const session = await tx.session.findUnique({ where: { id: targetSessionId } });
        if (!session) {
          throw new NotFoundException("Session not found");
        }

        await tx.session.update({
          where: { id: targetSessionId },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedReason: `revoked_by_user:${tenant.userId}`,
          },
        });
        await tx.refreshToken.updateMany({
          where: { sessionId: targetSessionId, status: "ACTIVE" },
          data: { status: "REVOKED", revokedAt: new Date(), revokedReason: "ADMIN_REVOKED" },
        });
        await tx.authenticationAuditEvent.create({
          data: {
            organizationId: tenant.organizationId,
            actingUserId: session.userId,
            sessionId: targetSessionId,
            eventType: "SESSION_REVOKED",
            ipAddress: meta.ip,
            userAgent: meta.userAgent?.slice(0, 512),
            metadata: { revokedByUserId: tenant.userId },
          },
        });
      },
    );
  }

  // Lists every organization the AUTHENTICATED caller belongs to — the
  // "Authorized Memberships" step in brief §12's switching flow. Uses the
  // auth_list_user_memberships bootstrap function (a cross-tenant read,
  // hence the SECURITY DEFINER escape hatch — see the RLS migration) but is
  // safe specifically because `tenant.userId` comes from the guard-validated
  // session, never from a client-supplied parameter: a caller can only ever
  // learn about their own memberships.
  async listMemberships(tenant: RequestTenantContext) {
    const rows = await this.prisma.client.$queryRaw<MembershipLookupRow[]>`
      SELECT * FROM auth_list_user_memberships(${tenant.userId}::uuid)
    `;
    return rows.map((row) => ({
      organizationId: row.organization_id,
      organizationDisplayName: row.organization_display_name,
      organizationType: row.organization_type,
      roleKey: row.role_key,
      roleName: row.role_name,
      status: row.membership_status,
    }));
  }

  // Switches the caller's active tenant WITHOUT re-entering a password —
  // the already-validated session (JwtAuthGuard + TenantContextGuard) is
  // the credential; only membership in the TARGET organization still needs
  // verifying. Mirrors login()'s membership-resolution exactly (brief §12:
  // "never allow a user to type an arbitrary organization UUID... and gain
  // access") — a platform super-admin may switch to any organization that
  // exists (audited as SUPER_ADMIN_ORG_ACCESS, same as at login); anyone
  // else needs a live ACTIVE OrganizationMembership row, or the switch is
  // rejected with the exact same generic error login() itself uses.
  async switchOrganization(
    tenant: RequestTenantContext,
    targetOrganizationId: string,
    meta: RequestMetadata,
  ) {
    const genericFailure = () => new UnauthorizedException("Not authorized for the requested organization");

    const result = await this.prisma.runWithTenant(
      { tenantId: targetOrganizationId, userId: tenant.userId },
      async (tx) => {
        const user = await tx.user.findUnique({ where: { id: tenant.userId } });
        if (!user || !user.isActive) {
          return null;
        }

        let roleKey: string;
        let permissions: PermissionKey[];
        let isSuperAdminSession = false;

        if (user.isPlatformSuperAdmin) {
          const targetOrganization = await tx.organization.findUnique({ where: { id: targetOrganizationId } });
          if (!targetOrganization) {
            return null;
          }
          const role = await tx.role.findUniqueOrThrow({
            where: { key: "nexa_super_admin" },
            include: { permissions: { include: { permission: true } } },
          });
          roleKey = role.key;
          permissions = role.permissions.map((rp) => rp.permission.key) as PermissionKey[];
          isSuperAdminSession = true;
        } else {
          const membership = await tx.organizationMembership.findFirst({
            where: { userId: tenant.userId, organizationId: targetOrganizationId, status: "ACTIVE" },
            include: { role: { include: { permissions: { include: { permission: true } } } } },
          });
          if (!membership) {
            return null;
          }
          roleKey = membership.role.key;
          permissions = membership.role.permissions.map((rp) => rp.permission.key) as PermissionKey[];
        }

        const session = await this.sessionService.createSession(tx, {
          userId: tenant.userId,
          organizationId: targetOrganizationId,
          isSuperAdminSession,
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
        });
        const { raw: refreshToken } = await this.refreshTokenService.issueInitial(tx, session.id);

        const accessToken = signAccessToken(
          {
            sub: tenant.userId,
            organization_id: targetOrganizationId,
            session_id: session.id,
            role_key: roleKey,
            token_type: "access",
          },
          this.tokenIssuerConfig,
          this.config.env.JWT_ACCESS_TTL,
        );

        await tx.authenticationAuditEvent.create({
          data: {
            organizationId: targetOrganizationId,
            actingUserId: tenant.userId,
            sessionId: session.id,
            eventType: isSuperAdminSession ? "SUPER_ADMIN_ORG_ACCESS" : "LOGIN_SUCCESS",
            ipAddress: meta.ip,
            userAgent: meta.userAgent?.slice(0, 512),
            metadata: { via: "switch_organization", fromOrganizationId: tenant.organizationId },
          },
        });

        return {
          accessToken,
          refreshToken,
          roleKey,
          permissions,
          user: { id: user.id, email: user.email },
        };
      },
    );

    if (!result) {
      await this.auditService.record({
        organizationId: targetOrganizationId,
        actingUserId: tenant.userId,
        eventType: "TENANT_ACCESS_DENIED",
        meta,
        metadata: { reason: "switch_organization_unauthorized", fromOrganizationId: tenant.organizationId },
      });
      throw genericFailure();
    }

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user,
      tenant: { organizationId: targetOrganizationId, roleKey: result.roleKey, permissions: result.permissions },
    };
  }

  async me(tenant: RequestTenantContext) {
    return this.prisma.runWithTenant(
      { tenantId: tenant.organizationId, userId: tenant.userId },
      async (tx) => {
        const user = await tx.user.findUniqueOrThrow({
          where: { id: tenant.userId },
          select: { id: true, email: true, firstName: true, lastName: true, phone: true, lastLoginAt: true },
        });
        return {
          user,
          tenant: {
            organizationId: tenant.organizationId,
            roleKey: tenant.roleKey,
            permissions: tenant.permissions,
            isSuperAdminSession: tenant.isSuperAdminSession,
          },
        };
      },
    );
  }
}
