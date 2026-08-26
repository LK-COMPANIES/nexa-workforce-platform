import { NextResponse } from "next/server";

// Lightweight liveness probe for the container healthcheck (docker-compose
// .prod.yml) — deliberately separate from /health (the human-facing
// diagnostic page, which also proxies the API's own health for convenience
// during manual debugging). This route does no I/O and no dependency
// checks: for a pure frontend, "the Next.js server can construct a
// response" already *is* the liveness signal — there's no local dependency
// (database, cache) to distinguish liveness from readiness for further.
export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
