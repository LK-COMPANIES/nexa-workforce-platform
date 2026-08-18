import { UnauthorizedException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { signAccessToken, type TokenIssuerConfig } from "@nexa/auth";
import type { ApiConfigService } from "../config/config.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

const tokenConfig: TokenIssuerConfig = {
  secret: "test-access-secret-at-least-32-characters",
  issuer: "nexa-test-issuer",
  audience: "nexa-test-audience",
};

const config = { env: { JWT_ACCESS_SECRET: tokenConfig.secret, JWT_ISSUER: tokenConfig.issuer, JWT_AUDIENCE: tokenConfig.audience } } as unknown as ApiConfigService;

function contextWithHeaders(headers: Record<string, string>): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = { headers };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
  return { context, request };
}

const validClaims = {
  sub: "user-1",
  organization_id: "org-1",
  session_id: "session-1",
  role_key: "client_admin",
  token_type: "access" as const,
};

describe("JwtAuthGuard", () => {
  const guard = new JwtAuthGuard(config);

  it("rejects a request with no Authorization header", () => {
    const { context } = contextWithHeaders({});
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a non-Bearer Authorization header", () => {
    const { context } = contextWithHeaders({ authorization: "Basic dXNlcjpwYXNz" });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a malformed token", () => {
    const { context } = contextWithHeaders({ authorization: "Bearer not-a-real-jwt" });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a token forged with a different secret", () => {
    const forged = signAccessToken(validClaims, { ...tokenConfig, secret: "a-different-secret-entirely-value" }, "15m");
    const { context } = contextWithHeaders({ authorization: `Bearer ${forged}` });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects an expired token", () => {
    const expired = signAccessToken(validClaims, tokenConfig, -1);
    const { context } = contextWithHeaders({ authorization: `Bearer ${expired}` });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("rejects a token issued for a different audience", () => {
    const wrongAudience = signAccessToken(validClaims, { ...tokenConfig, audience: "some-other-app" }, "15m");
    const { context } = contextWithHeaders({ authorization: `Bearer ${wrongAudience}` });
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it("accepts a valid token and populates identity fields with NO permissions yet", () => {
    const token = signAccessToken(validClaims, tokenConfig, "15m");
    const { context, request } = contextWithHeaders({ authorization: `Bearer ${token}` });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.tenantContext).toEqual({
      userId: "user-1",
      organizationId: "org-1",
      sessionId: "session-1",
      roleKey: "client_admin",
      permissions: [],
      isSuperAdminSession: false,
    });
  });
});
