import { Module } from "@nestjs/common";
import { AuthAuditModule } from "../auth/auth-audit.module";
import { PermissionsGuard } from "./permissions.guard";

@Module({
  imports: [AuthAuditModule],
  providers: [PermissionsGuard],
  exports: [PermissionsGuard],
})
export class AuthorizationModule {}
