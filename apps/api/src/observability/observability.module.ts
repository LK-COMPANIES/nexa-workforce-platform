import { Global, Module } from "@nestjs/common";
import { RequestIdMiddleware } from "./request-id.middleware";
import { StructuredLoggerService } from "./structured-logger.service";

@Global()
@Module({
  providers: [RequestIdMiddleware, StructuredLoggerService],
  exports: [RequestIdMiddleware, StructuredLoggerService],
})
export class ObservabilityModule {}
