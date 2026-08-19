import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { verifyAccessToken } from "@nexa/auth";
import type { PermissionKey } from "@nexa/types";
import type { Request } from "express";
import { ApiConfigService } from "../config/config.service";
import type { RequestTenantContext } from "../tenancy/types";

// Verifies the access token's signature/expiry/issuer/audience — identity
// only. Populates request.tenantContext with IDENTITY fields (userId,
// organizationId, sessionId) and empty permissions. Authorization
// (live session + membership + current permissions) is TenantContextGuard's
// job, which MUST run immediately after this guard on every protected route.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly config: ApiConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenantContext?: RequestTenantContext; rawAccessToken?: string }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new UnauthorizedException("Missing bearer token");
    }

    const token = header.slice("Bearer ".length);
    try {
      const claims = verifyAccessToken(token, {
        secret: this.config.env.JWT_ACCESS_SECRET,
        issuer: this.config.env.JWT_ISSUER,
        audience: this.config.env.JWT_AUDIENCE,
      });
      request.tenantContext = {
        userId: claims.sub,
        organizationId: claims.organization_id,
        sessionId: claims.session_id,
        roleKey: claims.role_key,
        permissions: [] as PermissionKey[],
        isSuperAdminSession: false,
      };
      // Retained verbatim (not re-derived) so downstream service-to-service
      // calls — currently only AiService forwarding to apps/ai — can present
      // the exact token this guard just verified, rather than apps/api
      // minting a second, parallel credential. See CurrentAccessToken().
      request.rawAccessToken = token;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
