import type { Request } from "express";

export interface RequestMetadata {
  ip?: string;
  userAgent?: string;
}

export function extractRequestMetadata(request: Request): RequestMetadata {
  const forwarded = request.headers["x-forwarded-for"];
  const ip =
    (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) ??
    request.ip ??
    request.socket.remoteAddress;
  const userAgentHeader = request.headers["user-agent"];
  return {
    ip,
    userAgent: typeof userAgentHeader === "string" ? userAgentHeader : undefined,
  };
}
