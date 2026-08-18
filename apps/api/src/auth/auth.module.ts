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
  exports: [JwtAuthGuard],
})
export class AuthModule {}
