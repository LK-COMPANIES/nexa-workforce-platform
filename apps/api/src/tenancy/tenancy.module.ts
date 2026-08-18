import { Module } from "@nestjs/common";
import { AuthAuditModule } from "../auth/auth-audit.module";
import { TenantContextGuard } from "./tenant-context.guard";

@Module({
  imports: [AuthAuditModule],
  providers: [TenantContextGuard],
  exports: [TenantContextGuard],
})
export class TenancyModule {}
