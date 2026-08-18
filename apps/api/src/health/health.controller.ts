import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check() {
    const [databaseUp, redisUp] = await Promise.all([this.checkDatabase(), this.checkRedis()]);
    return {
      status: databaseUp && redisUp ? "ok" : "degraded",
      database: databaseUp ? "up" : "down",
      redis: redisUp ? "up" : "down",
      timestamp: new Date().toISOString(),
    };
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
