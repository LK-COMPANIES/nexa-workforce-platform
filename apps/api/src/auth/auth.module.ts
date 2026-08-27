import { Module } from "@nestjs/common";
import { AuthorizationModule } from "../authorization/authorization.module";
import { TenancyModule } from "../tenancy/tenancy.module";
import { AuthAuditModule } from "./auth-audit.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RefreshTokenService } from "./refresh-token.service";
import { SessionService } from "./session.service";

@Module({
  imports: [TenancyModule, AuthorizationModule, AuthAuditModule],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, SessionService, RefreshTokenService],
  // AuthService exported so OrganizationsModule can inject it for the
  // member-invite endpoint (Phase 6) — invite/accept-invite are identity-
  // creation operations with the exact same runWithTenant/hashPassword
  // patterns as register()/switchOrganization() above, so they live here
  // rather than duplicating that logic in a new service.
  exports: [JwtAuthGuard, AuthService],
})
export class AuthModule {}
