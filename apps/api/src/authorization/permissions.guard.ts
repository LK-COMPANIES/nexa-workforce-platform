import { CanActivate, type ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { PermissionKey } from "@nexa/types";
import type { Request } from "express";
import { AuthAuditService } from "../auth/auth-audit.service";
import { extractRequestMetadata } from "../common/request-metadata.util";
import type { RequestTenantContext } from "../tenancy/types";
import { PERMISSIONS_METADATA_KEY } from "./require-permission.decorator";

// Must run after JwtAuthGuard + TenantContextGuard — checks against
// request.tenantContext.permissions, which by this point holds permissions
// read fresh from the database (never the access token's own claims; the
// token carries no permissions array — see jwt-auth.guard.ts).
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuthAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<PermissionKey[] | undefined>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { tenantContext?: RequestTenantContext }>();
    const tenant = request.tenantContext;
    const granted = new Set(tenant?.permissions ?? []);
    const missing = required.filter((permission) => !granted.has(permission));

    if (missing.length > 0) {
      if (tenant) {
        await this.auditService.record({
          organizationId: tenant.organizationId,
          actingUserId: tenant.userId,
          sessionId: tenant.sessionId,
          eventType: "UNAUTHORIZED_ACCESS_ATTEMPT",
          meta: extractRequestMetadata(request),
          metadata: { missingPermissions: missing, path: request.path, method: request.method },
        });
      }
      throw new ForbiddenException(`Missing required permission(s): ${missing.join(", ")}`);
    }
    return true;
  }
}
