import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

// The raw, still-valid access token JwtAuthGuard just verified for this
// request. Narrowly scoped to the one legitimate use case: forwarding the
// caller's own proven identity to apps/ai (see ai/ai.service.ts) so that
// service can independently verify it and derive organization_id from the
// token itself — never from anything apps/api or the browser sends it in a
// request body.
export const CurrentAccessToken = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<Request & { rawAccessToken?: string }>();
  if (!request.rawAccessToken) {
    throw new Error("@CurrentAccessToken() used on a route not protected by JwtAuthGuard.");
  }
  return request.rawAccessToken;
});
