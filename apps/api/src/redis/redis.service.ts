import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";
import { ApiConfigService } from "../config/config.service";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ApiConfigService) {
    this.client = new Redis(config.env.REDIS_URL);
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
