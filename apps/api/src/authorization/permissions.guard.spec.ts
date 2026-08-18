import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import type { Reflector } from "@nestjs/core";
import type { PermissionKey } from "@nexa/types";
import type { AuthAuditService } from "../auth/auth-audit.service";
import type { RequestTenantContext } from "../tenancy/types";
import { PermissionsGuard } from "./permissions.guard";

function buildContext(tenantContext: RequestTenantContext | undefined): ExecutionContext {
  const request = { tenantContext, headers: {}, socket: {}, path: "/test", method: "GET" };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function tenant(overrides: Partial<RequestTenantContext> = {}): RequestTenantContext {
  return {
    userId: "user-1",
    organizationId: "org-1",
    sessionId: "session-1",
    roleKey: "hr_manager",
    permissions: ["employee:read"] as PermissionKey[],
    isSuperAdminSession: false,
    ...overrides,
  };
}

function makeGuard(required: PermissionKey[] | undefined) {
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(required) } as unknown as Reflector;
  const auditService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuthAuditService;
  return { guard: new PermissionsGuard(reflector, auditService), auditService };
}

describe("PermissionsGuard", () => {
  it("allows the request through when the route requires no permission", async () => {
    const { guard } = makeGuard(undefined);
    await expect(guard.canActivate(buildContext(tenant()))).resolves.toBe(true);
  });

  it("allows the request when the caller holds the required permission", async () => {
    const { guard } = makeGuard(["employee:read"]);
    await expect(guard.canActivate(buildContext(tenant()))).resolves.toBe(true);
  });

  it("denies and audits UNAUTHORIZED_ACCESS_ATTEMPT when the caller lacks the required permission", async () => {
    const { guard, auditService } = makeGuard(["payroll:approve"]);
    await expect(guard.canActivate(buildContext(tenant()))).rejects.toThrow(ForbiddenException);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "UNAUTHORIZED_ACCESS_ATTEMPT" }),
    );
  });

  it("denies when the caller holds only some of several required permissions", async () => {
    const { guard } = makeGuard(["employee:read", "payroll:approve"]);
    await expect(guard.canActivate(buildContext(tenant()))).rejects.toThrow(ForbiddenException);
  });

  it("denies a wrong-role caller with an entirely disjoint permission set (bpo_agent vs payroll:approve)", async () => {
    const { guard } = makeGuard(["payroll:approve"]);
    const bpoAgent = tenant({ roleKey: "bpo_agent", permissions: ["employee:read"] as PermissionKey[] });
    await expect(guard.canActivate(buildContext(bpoAgent))).rejects.toThrow(ForbiddenException);
  });

  it("denies when there is no tenant context at all (defense in depth) without attempting to audit", async () => {
    const { guard, auditService } = makeGuard(["employee:read"]);
    await expect(guard.canActivate(buildContext(undefined))).rejects.toThrow(ForbiddenException);
    expect(auditService.record).not.toHaveBeenCalled();
  });
});
