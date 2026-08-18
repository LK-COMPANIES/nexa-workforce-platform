import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { AuthAuditService } from "../auth/auth-audit.service";
import type { PrismaService } from "../prisma/prisma.service";
import { TenantContextGuard } from "./tenant-context.guard";
import type { RequestTenantContext } from "./types";

function baseClaims(overrides: Partial<RequestTenantContext> = {}): RequestTenantContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    sessionId: "session-1",
    roleKey: "client_admin",
    permissions: [],
    isSuperAdminSession: false,
    ...overrides,
  };
}

function buildContext(tenantContext: RequestTenantContext | undefined) {
  const request: Record<string, unknown> = { tenantContext, headers: {}, socket: {} };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { context, request };
}

function makeGuard(tx: Record<string, unknown>) {
  const prisma = {
    runWithTenant: jest.fn((_ctx: unknown, fn: (tx: unknown) => unknown) => fn(tx)),
  } as unknown as PrismaService;
  const audit = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuthAuditService;
  return { guard: new TenantContextGuard(prisma, audit), audit };
}

const activeSession = {
  id: "session-1",
  userId: "user-1",
  organizationId: "org-1",
  status: "ACTIVE",
  isSuperAdminSession: false,
  expiresAt: new Date(Date.now() + 60_000),
};
const activeUser = { id: "user-1", isActive: true, isPlatformSuperAdmin: false };
const activeMembership = {
  role: { key: "client_admin", permissions: [{ permission: { key: "organization:read" } }] },
};

describe("TenantContextGuard", () => {
  it("rejects when request.tenantContext is entirely missing", async () => {
    const { guard } = makeGuard({});
    const { context } = buildContext(undefined);
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects and audits SESSION_REVOKED when the named session doesn't exist", async () => {
    const tx = { session: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() } };
    const { guard, audit } = makeGuard(tx);
    const { context } = buildContext(baseClaims());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "SESSION_REVOKED" }));
  });

  it("rejects and audits SESSION_REVOKED when the session status is REVOKED", async () => {
    const tx = {
      session: { findUnique: jest.fn().mockResolvedValue({ ...activeSession, status: "REVOKED" }), update: jest.fn() },
    };
    const { guard, audit } = makeGuard(tx);
    const { context } = buildContext(baseClaims());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "SESSION_REVOKED" }));
  });

  it("rejects and audits SESSION_REVOKED when the session has expired", async () => {
    const tx = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ ...activeSession, expiresAt: new Date(Date.now() - 1000) }),
        update: jest.fn(),
      },
    };
    const { guard, audit } = makeGuard(tx);
    const { context } = buildContext(baseClaims());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "SESSION_REVOKED" }));
  });

  it("rejects with ForbiddenException and audits ACCOUNT_DISABLED for an inactive user", async () => {
    const tx = {
      session: { findUnique: jest.fn().mockResolvedValue(activeSession), update: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue({ ...activeUser, isActive: false }) },
    };
    const { guard, audit } = makeGuard(tx);
    const { context } = buildContext(baseClaims());
    await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "ACCOUNT_DISABLED" }));
  });

  it("rejects and audits TENANT_ACCESS_DENIED when there is no active OrganizationMembership — the mandatory 'unauthorized organization' case", async () => {
    const tx = {
      session: { findUnique: jest.fn().mockResolvedValue(activeSession), update: jest.fn() },
      user: { findUnique: jest.fn().mockResolvedValue(activeUser) },
      organizationMembership: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const { guard, audit } = makeGuard(tx);
    const { context } = buildContext(baseClaims());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "TENANT_ACCESS_DENIED" }));
  });

  it("succeeds and overwrites roleKey/permissions with the DB-fresh values, discarding any stale claim", async () => {
    const tx = {
      session: { findUnique: jest.fn().mockResolvedValue(activeSession), update: jest.fn().mockResolvedValue({}) },
      user: { findUnique: jest.fn().mockResolvedValue(activeUser) },
      organizationMembership: { findFirst: jest.fn().mockResolvedValue(activeMembership) },
    };
    const { guard } = makeGuard(tx);
    const claims = baseClaims({ roleKey: "STALE_ROLE", permissions: ["stale:permission"] as never });
    const { context, request } = buildContext(claims);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    const resolved = request.tenantContext as RequestTenantContext;
    expect(resolved.roleKey).toBe("client_admin");
    expect(resolved.permissions).toEqual(["organization:read"]);
  });

  it("grants a super-admin session the full nexa_super_admin permission set without querying OrganizationMembership", async () => {
    const role = { key: "nexa_super_admin", permissions: [{ permission: { key: "platform:manage_organizations" } }] };
    const tx = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ ...activeSession, isSuperAdminSession: true }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ ...activeUser, isPlatformSuperAdmin: true }) },
      role: { findUnique: jest.fn().mockResolvedValue(role) },
      organizationMembership: { findFirst: jest.fn() },
    };
    const { guard } = makeGuard(tx);
    const { context, request } = buildContext(baseClaims());

    await expect(guard.canActivate(context)).resolves.toBe(true);
    const resolved = request.tenantContext as RequestTenantContext;
    expect(resolved.isSuperAdminSession).toBe(true);
    expect(resolved.permissions).toEqual(["platform:manage_organizations"]);
    expect(tx.organizationMembership.findFirst).not.toHaveBeenCalled();
  });

  it("denies a super-admin-flagged session if the user's super-admin flag was revoked after issuance (defense in depth)", async () => {
    const tx = {
      session: {
        findUnique: jest.fn().mockResolvedValue({ ...activeSession, isSuperAdminSession: true }),
        update: jest.fn(),
      },
      user: { findUnique: jest.fn().mockResolvedValue({ ...activeUser, isPlatformSuperAdmin: false }) },
    };
    const { guard, audit } = makeGuard(tx);
    const { context } = buildContext(baseClaims());
    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ eventType: "TENANT_ACCESS_DENIED" }));
  });
});
