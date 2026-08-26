import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

// Liveness vs readiness (brief §15): liveness answers "is the process
// alive" and must never depend on anything external — a Postgres or Redis
// outage must not make an orchestrator conclude the API process itself is
// dead and kill/restart it, which would just make the outage worse.
// Readiness answers "can this instance actually serve a real request right
// now" and DOES check dependencies — this is what Docker/orchestrator
// healthchecks should target (see docker-compose.prod.yml).
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get("live")
  live() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Get("ready")
  @HttpCode(HttpStatus.OK)
  async ready() {
    const [databaseUp, redisUp] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    const status = databaseUp && redisUp ? "ok" : "degraded";
    const body = { status, database: databaseUp ? "up" : "down", redis: redisUp ? "up" : "down", timestamp: new Date().toISOString() };
    // A 200 with status:"degraded" is indistinguishable from "healthy" to
    // anything checking only the HTTP status code (brief failure condition
    // #17: "health checks report healthy services that cannot actually
    // serve requests") — an orchestrator's healthcheck should fail loudly.
    if (status !== "ok") {
      throw new ServiceUnavailableException(body);
    }
    return body;
  }

  // Kept as an alias of readiness for backward compatibility with anything
  // still pointed at the pre-Phase-5 single /health endpoint (the dev
  // docker-compose healthcheck, apps/web's diagnostic page).
  @Get()
  async check() {
    return this.ready();
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      return (await this.redis.client.ping()) === "PONG";
    } catch {
      return false;
    }
  }
}
