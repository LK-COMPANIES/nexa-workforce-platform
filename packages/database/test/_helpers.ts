// Shared by every *.integration.ts script in this directory. These scripts
// require a live Postgres with migrations + RLS already applied — safe to
// leave wired into local dev without Docker (skip cleanly), but a CI run
// that can't reach its own disposable Postgres service is a CI
// misconfiguration, not a reason to silently report success (Phase 5
// brief failure condition #4 — "RLS tests fail" must fail the build; a
// test that never actually ran is not a passing test).
export function reportUnreachableDatabase(scriptName: string): void {
  const message =
    `${scriptName}: no reachable Postgres (DIRECT_DATABASE_URL / DATABASE_URL). ` +
    "Run `docker compose up -d postgres && npm run db:migrate && npm run db:rls` first.";

  if (process.env.CI === "true") {
    console.error(`FAILED: ${message} Running in CI — a missing database service is a hard failure, not a skip.`);
    process.exitCode = 1;
    return;
  }

  console.log(`SKIPPED: ${message}`);
  process.exitCode = 0;
}
