import { Module } from "@nestjs/common";
import { AuthAuditModule } from "../auth/auth-audit.module";
import { TenantContextGuard } from "./tenant-context.guard";

@Module({
  imports: [AuthAuditModule],
  providers: [TenantContextGuard],
  // Re-exporting AuthAuditModule (not just TenantContextGuard) matters:
  // `@UseGuards(TenantContextGuard)` is resolved by Nest within the DI
  // context of the module that declares the CONTROLLER using it, not just
  // wherever the guard happens to be provided — so every module that
  // imports TenancyModule needs AuthAuditService independently visible in
  // its own scope too, or guard construction fails with "Nest can't
  // resolve dependencies of TenantContextGuard (PrismaService, ?)" the
  // moment the app is actually instantiated (a failure unit tests that
  // construct the guard directly, bypassing Nest's DI container entirely,
  // cannot catch — only a real Test.createTestingModule(AppModule) boot
  // can, which is exactly what apps/api/test/*.integration.spec.ts do).
  exports: [TenantContextGuard, AuthAuditModule],
})
export class TenancyModule {}
