import { Module } from "@nestjs/common";
import { AuthAuditModule } from "../auth/auth-audit.module";
import { PermissionsGuard } from "./permissions.guard";

@Module({
  imports: [AuthAuditModule],
  providers: [PermissionsGuard],
  // Same reasoning as TenancyModule's identical re-export — PermissionsGuard
  // also depends on AuthAuditService, and `@UseGuards(PermissionsGuard)` is
  // resolved within each consuming module's own DI scope.
  exports: [PermissionsGuard, AuthAuditModule],
})
export class AuthorizationModule {}
