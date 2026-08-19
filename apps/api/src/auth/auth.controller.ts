import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import {
  loginSchema,
  refreshTokenSchema,
  registerClientOrganizationSchema,
  revokeSessionSchema,
  switchOrganizationSchema,
  type LoginInput,
  type RefreshTokenInput,
  type RegisterClientOrganizationInput,
  type RevokeSessionInput,
  type SwitchOrganizationInput,
} from "@nexa/validation";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { extractRequestMetadata } from "../common/request-metadata.util";
import { RequirePermission } from "../authorization/require-permission.decorator";
import { PermissionsGuard } from "../authorization/permissions.guard";
import { CurrentTenant } from "../tenancy/current-tenant.decorator";
import { TenantContextGuard } from "../tenancy/tenant-context.guard";
import type { RequestTenantContext } from "../tenancy/types";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  register(
    @Body(new ZodValidationPipe(registerClientOrganizationSchema)) body: RegisterClientOrganizationInput,
    @Req() request: Request,
  ) {
    return this.authService.register(body, extractRequestMetadata(request));
  }

  @Post("login")
  @HttpCode(200)
  login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput, @Req() request: Request) {
    return this.authService.login(body, extractRequestMetadata(request));
  }

  @Post("refresh")
  @HttpCode(200)
  refresh(@Body(new ZodValidationPipe(refreshTokenSchema)) body: RefreshTokenInput, @Req() request: Request) {
    return this.authService.refresh(body.refreshToken, extractRequestMetadata(request));
  }

  @Post("logout")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  async logout(@CurrentTenant() tenant: RequestTenantContext, @Req() request: Request): Promise<void> {
    await this.authService.logout(tenant, extractRequestMetadata(request));
  }

  // Admin-initiated revocation of an arbitrary session within the caller's
  // own organization (RLS-enforced — see AuthService.revokeSession).
  @Post("revoke")
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, TenantContextGuard, PermissionsGuard)
  @RequirePermission("user:disable")
  async revoke(
    @Body(new ZodValidationPipe(revokeSessionSchema)) body: RevokeSessionInput,
    @CurrentTenant() tenant: RequestTenantContext,
    @Req() request: Request,
  ): Promise<void> {
    await this.authService.revokeSession(tenant, body.sessionId, extractRequestMetadata(request));
  }

  @Get("me")
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  me(@CurrentTenant() tenant: RequestTenantContext) {
    return this.authService.me(tenant);
  }

  // The organization switcher's data source (brief §12/§21) — every org the
  // caller is authorized to switch into.
  @Get("memberships")
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  listMemberships(@CurrentTenant() tenant: RequestTenantContext) {
    return this.authService.listMemberships(tenant);
  }

  @Post("switch-organization")
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, TenantContextGuard)
  switchOrganization(
    @Body(new ZodValidationPipe(switchOrganizationSchema)) body: SwitchOrganizationInput,
    @CurrentTenant() tenant: RequestTenantContext,
    @Req() request: Request,
  ) {
    return this.authService.switchOrganization(tenant, body.organizationId, extractRequestMetadata(request));
  }
}
