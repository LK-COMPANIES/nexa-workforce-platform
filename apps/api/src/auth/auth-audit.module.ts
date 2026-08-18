import { Module } from "@nestjs/common";
import { AuthAuditService } from "./auth-audit.service";

// Split out from AuthModule so both AuthModule (writes LOGIN_SUCCESS etc.)
// and TenancyModule (writes TENANT_ACCESS_DENIED etc. from
// TenantContextGuard) can depend on it without a circular module import.
@Module({
  providers: [AuthAuditService],
  exports: [AuthAuditService],
})
export class AuthAuditModule {}
