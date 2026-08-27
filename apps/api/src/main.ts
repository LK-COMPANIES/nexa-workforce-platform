import "reflect-metadata";
import helmet from "helmet";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { AllExceptionsFilter } from "./common/all-exceptions.filter";
import { ApiConfigService } from "./config/config.service";
import { StructuredLoggerService } from "./observability/structured-logger.service";

async function bootstrap(): Promise<void> {
  // bufferLogs holds Nest's own bootstrap-time log lines (module init,
  // route mapping, etc.) until useLogger() below attaches the real logger,
  // instead of letting them print via Nest's default unstructured console
  // logger first.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(StructuredLoggerService));

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
  app.get(StructuredLoggerService).log(`Nexa API listening on port ${config.env.API_PORT}`, "Bootstrap");
}

bootstrap();
