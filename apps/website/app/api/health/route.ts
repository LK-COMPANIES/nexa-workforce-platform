import { NextResponse } from "next/server";

// Liveness probe for the container healthcheck — this app has no database
// or external dependency to check readiness against, so liveness is the
// whole story here (unlike apps/web/apps/api, which distinguish the two).
export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
}
