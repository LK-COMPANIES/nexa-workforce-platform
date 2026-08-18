import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { RequestTenantContext } from "./types";

// Requires JwtAuthGuard AND TenantContextGuard to have already run (in that
// order) — only after both has request.tenantContext been fully, freshly
// validated against the database.
export const CurrentTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestTenantContext => {
    const request = ctx.switchToHttp().getRequest<Request & { tenantContext?: RequestTenantContext }>();
    if (!request.tenantContext) {
      throw new Error("@CurrentTenant() used on a route not protected by JwtAuthGuard + TenantContextGuard.");
    }
    return request.tenantContext;
  },
);
