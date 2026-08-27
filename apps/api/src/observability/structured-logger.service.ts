import { Injectable, type LoggerService } from "@nestjs/common";
import { getRequestContext } from "./request-context";

function safeStringify(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

// JSON-lines to stdout/stderr — deliberately not a logging framework
// (winston/pino) or a shipped-out integration (brief §42: "do not
// introduce a heavyweight observability stack unless justified"). A
// container platform's own log collector reads structured JSON off
// stdout/stderr natively; this is the extension point that OpenTelemetry/
// a log-shipping sidecar/Grafana Loki etc. would consume, not a
// replacement for any of them. Implements Nest's own LoggerService
// interface so `app.useLogger(new StructuredLoggerService())` in main.ts
// is the only wiring needed — every existing `new Logger(...)` call site
// (e.g. AllExceptionsFilter) gets structured output for free, unchanged.
@Injectable()
export class StructuredLoggerService implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write("log", message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write("error", message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write("warn", message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write("debug", message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write("verbose", message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write("fatal", message, optionalParams);
  }

  private write(level: string, message: unknown, optionalParams: unknown[]): void {
    const context = getRequestContext();
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message: safeStringify(message),
      requestId: context?.requestId,
      organizationId: context?.organizationId,
      userId: context?.userId,
    };

    // Nest's own internal convention: error() is called as
    // (message, stack, context); every other level as (message, ..., context)
    // with a trailing string context label.
    if (level === "error" && optionalParams.length >= 2) {
      entry.stack = optionalParams[0];
      entry.context = optionalParams[1];
    } else if (optionalParams.length > 0 && typeof optionalParams[optionalParams.length - 1] === "string") {
      entry.context = optionalParams[optionalParams.length - 1];
      const rest = optionalParams.slice(0, -1);
      if (rest.length > 0) entry.extra = rest;
    } else if (optionalParams.length > 0) {
      entry.extra = optionalParams;
    }

    // log/debug/verbose are routine operational output; warn/error/fatal
    // are attention-worthy — the conventional stdout/stderr split lets a
    // container log collector (or a human piping output) filter on stream
    // alone without parsing every line's `level` field.
    const stream = level === "warn" || level === "error" || level === "fatal" ? process.stderr : process.stdout;
    stream.write(`${JSON.stringify(entry)}\n`);
  }
}
