import { type MiddlewareConsumer, Module, type NestModule } from "@nestjs/common";
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
import { EmployeesModule } from "./employees/employees.module";
import { AiModule } from "./ai/ai.module";
import { ObservabilityModule } from "./observability/observability.module";
import { RequestIdMiddleware } from "./observability/request-id.middleware";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    ObservabilityModule,
    // Global rate limiting extension point: 100 requests / 60s per client by
    // default. Enforced via APP_GUARD below, not merely declared — routes
    // can override with @Throttle() as auth/payroll endpoints mature.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    AuthModule,
    OrganizationsModule,
    HealthModule,
    PayrollModule,
    ContractsModule,
    EmployeesModule,
    AiModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // First in the chain, ahead of every guard — every log line for the
    // lifetime of a request (including ones written from inside a guard
    // that rejects it) carries the same request ID.
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
