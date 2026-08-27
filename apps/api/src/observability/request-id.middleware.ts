import { randomUUID } from "node:crypto";
import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { runWithRequestContext } from "./request-context";

const REQUEST_ID_HEADER = "x-request-id";

// First middleware in the chain (registered in app.module.ts's configure())
// — runs before every guard/controller. Reuses an inbound X-Request-Id
// when a caller/load-balancer already set one (so a request ID stays
// stable across service boundaries — apps/web could forward the one it
// received from the browser's perspective, apps/ai could echo one back),
// otherwise mints a new one. Always sets it on the response too, so a
// client (or a human debugging with curl) can correlate what they saw
// with what shows up in this service's structured logs.
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId = (req.headers[REQUEST_ID_HEADER] as string | undefined) || randomUUID();
    res.setHeader("X-Request-Id", requestId);
    runWithRequestContext({ requestId }, () => next());
  }
}
