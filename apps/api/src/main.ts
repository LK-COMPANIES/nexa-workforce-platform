import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { ApiConfigService } from "./config/config.service";

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ApiConfigService);

  app.use(helmet());
  app.enableCors({ origin: config.env.WEB_APP_URL, credentials: true });
  app.useGlobalFilters(new AllExceptionsFilter());

  // Without this, Nest never registers SIGTERM/SIGINT listeners at all —
  // PrismaService.onModuleDestroy() and RedisService.onModuleDestroy()
  // (both already implemented) would simply never fire on container stop,
  // leaking the DB pool and Redis connection on every deploy/restart
  // instead of closing them (brief §43). `app.close()` itself is what
  // stops new connections from being accepted before the process exits —
  // enableShutdownHooks is what wires a received signal to that call.
  app.enableShutdownHooks();

  await app.listen(config.env.API_PORT);
  // eslint-disable-next-line no-console
  console.log(`Nexa API listening on port ${config.env.API_PORT}`);
}

bootstrap();
