import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule } from "./config/config.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { HealthModule } from "./health/health.module";
import { PayrollModule } from "./payroll/payroll.module";
import { ContractsModule } from "./contracts/contracts.module";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    // Global rate limiting extension point: 100 requests / 60s per client by
    // default. Enforced via APP_GUARD below, not merely declared — routes
    // can override with @Throttle() as auth/payroll endpoints mature.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    OrganizationsModule,
    HealthModule,
    PayrollModule,
    ContractsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
