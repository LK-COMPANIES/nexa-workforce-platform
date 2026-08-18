import { UnauthorizedException } from "@nestjs/common";
import { hashPassword } from "@nexa/auth";
import { AuthService } from "./auth.service";
import type { ApiConfigService } from "../config/config.service";
import type { PrismaService } from "../prisma/prisma.service";
import type { AuthAuditService } from "./auth-audit.service";
import type { RefreshTokenService } from "./refresh-token.service";
import type { SessionService } from "./session.service";

const config = {
  env: {
    JWT_ACCESS_SECRET: "test-access-secret-at-least-32-characters",
    JWT_ISSUER: "nexa-test",
    JWT_AUDIENCE: "nexa-test-clients",
    JWT_ACCESS_TTL: "15m",
    JWT_REFRESH_TTL: "7d",
  },
} as unknown as ApiConfigService;

function makeAuthService(overrides: {
  queryRawResult: unknown[];
  txImpl: Record<string, unknown>;
}) {
  const prisma = {
    client: { $queryRaw: jest.fn().mockResolvedValue(overrides.queryRawResult) },
    runWithTenant: jest.fn((_ctx: unknown, fn: (tx: unknown) => unknown) => fn(overrides.txImpl)),
  } as unknown as PrismaService;
  const sessionService = {
    createSession: jest.fn().mockResolvedValue({ id: "new-session" }),
  } as unknown as SessionService;
  const refreshTokenService = {
    issueInitial: jest.fn().mockResolvedValue({ raw: "new-raw-token" }),
    issue: jest.fn().mockResolvedValue({ raw: "rotated-raw-token" }),
  } as unknown as RefreshTokenService;
  const auditService = { record: jest.fn().mockResolvedValue(undefined) } as unknown as AuthAuditService;

  const service = new AuthService(prisma, config, sessionService, refreshTokenService, auditService);
  return { service, prisma, sessionService, refreshTokenService, auditService };
}

describe("AuthService.login — account enumeration resistance", () => {
  it("throws the same generic message for an unknown email as for a wrong password", async () => {
    const unknownEmail = makeAuthService({ queryRawResult: [], txImpl: {} });
    const unknownPromise = unknownEmail.service.login(
      { email: "nobody@example.test", password: "irrelevant-value", organizationId: "org-1" },
      {},
    );
    await expect(unknownPromise).rejects.toThrow(UnauthorizedException);
    await expect(unknownPromise).rejects.toThrow("Invalid credentials");

    const hash = await hashPassword("the-real-password-value");
    const wrongPassword = makeAuthService({
      queryRawResult: [{ id: "u1", email: "real@example.test", password_hash: hash, is_active: true, is_platform_super_admin: false }],
      txImpl: {},
    });
    const wrongPasswordPromise = wrongPassword.service.login(
      { email: "real@example.test", password: "not-the-real-password", organizationId: "org-1" },
      {},
    );
    await expect(wrongPasswordPromise).rejects.toThrow(UnauthorizedException);
    await expect(wrongPasswordPromise).rejects.toThrow("Invalid credentials");
  });

  it("throws the same generic message for a disabled account", async () => {
    const { service } = makeAuthService({
      queryRawResult: [
        { id: "u1", email: "disabled@example.test", password_hash: "irrelevant", is_active: false, is_platform_super_admin: false },
      ],
      txImpl: {},
    });
    await expect(
      service.login({ email: "disabled@example.test", password: "anything", organizationId: "org-1" }, {}),
    ).rejects.toThrow("Invalid credentials");
  });

  it("records a LOGIN_FAILURE audit event with an internal-only reason, never exposed to the caller", async () => {
    const { service, auditService } = makeAuthService({ queryRawResult: [], txImpl: {} });
    await expect(
      service.login({ email: "nobody@example.test", password: "x", organizationId: "org-1" }, {}),
    ).rejects.toThrow();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "LOGIN_FAILURE", metadata: { reason: "unknown_email" } }),
    );
  });
});

describe("AuthService.refresh — rotation and reuse detection", () => {
  const activeRow = {
    refresh_token_id: "rt-1",
    family_id: "family-1",
    refresh_token_status: "ACTIVE",
    refresh_token_expires_at: new Date(Date.now() + 60_000),
    session_id: "session-1",
    session_status: "ACTIVE",
    session_expires_at: new Date(Date.now() + 60_000),
    is_super_admin_session: false,
    user_id: "user-1",
    organization_id: "org-1",
  };

  it("throws when the presented token has no matching row at all", async () => {
    const { service } = makeAuthService({ queryRawResult: [], txImpl: {} });
    await expect(service.refresh("unknown-raw-token", {})).rejects.toThrow(UnauthorizedException);
  });

  it("rotates a valid ACTIVE token: retires it and issues a new one in the same family", async () => {
    const tx = {
      refreshToken: { update: jest.fn().mockResolvedValue({}) },
      role: { findUniqueOrThrow: jest.fn() },
      organizationMembership: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ role: { key: "client_admin", permissions: [{ permission: { key: "organization:read" } }] } }),
      },
      session: { update: jest.fn().mockResolvedValue({}) },
      authenticationAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const { service, refreshTokenService } = makeAuthService({ queryRawResult: [activeRow], txImpl: tx });

    const result = await service.refresh("some-raw-refresh-token", {});

    expect(tx.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "rt-1" },
      data: expect.objectContaining({ status: "ROTATED" }),
    });
    expect(refreshTokenService.issue).toHaveBeenCalledWith(tx, "session-1", "family-1");
    expect(result.refreshToken).toBe("rotated-raw-token");
    expect(result.tenant.roleKey).toBe("client_admin");
  });

  it("treats a ROTATED (already-consumed) token being reused as theft: revokes the whole family and session", async () => {
    const reuseTx = {
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      session: { update: jest.fn().mockResolvedValue({}) },
      authenticationAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const rotatedRow = { ...activeRow, refresh_token_status: "ROTATED" };
    const { service } = makeAuthService({ queryRawResult: [rotatedRow], txImpl: reuseTx });

    await expect(service.refresh("a-reused-raw-token", {})).rejects.toThrow(/reuse detected/i);

    expect(reuseTx.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { familyId: "family-1", status: "ACTIVE" },
      data: expect.objectContaining({ status: "REVOKED", revokedReason: "REUSE_DETECTED" }),
    });
    expect(reuseTx.session.update).toHaveBeenCalledWith({
      where: { id: "session-1" },
      data: expect.objectContaining({ status: "REVOKED", revokedReason: "REUSE_DETECTED" }),
    });
    expect(reuseTx.authenticationAuditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "REFRESH_REUSE_DETECTED" }) }),
    );
  });

  it("treats a REVOKED token being presented as theft too, not just ROTATED", async () => {
    const reuseTx = {
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      session: { update: jest.fn().mockResolvedValue({}) },
      authenticationAuditEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const revokedRow = { ...activeRow, refresh_token_status: "REVOKED" };
    const { service } = makeAuthService({ queryRawResult: [revokedRow], txImpl: reuseTx });

    await expect(service.refresh("a-revoked-raw-token", {})).rejects.toThrow(/reuse detected/i);
  });

  it("rejects an expired-but-still-ACTIVE refresh token without treating it as reuse", async () => {
    const expiredRow = { ...activeRow, refresh_token_expires_at: new Date(Date.now() - 1000) };
    const { service } = makeAuthService({ queryRawResult: [expiredRow], txImpl: {} });
    await expect(service.refresh("an-expired-raw-token", {})).rejects.toThrow(/expired/i);
  });
});
