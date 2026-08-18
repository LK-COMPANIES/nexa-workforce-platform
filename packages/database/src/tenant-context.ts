import { AsyncLocalStorage } from "node:async_hooks";
import type { Prisma, PrismaClient } from "@prisma/client";

// -----------------------------------------------------------------------------
// Tenant context — the single sanctioned way any Nexa service touches
// tenant-scoped tables. See packages/database/prisma/rls/001_enable_row_level_security.sql
// for the database-side enforcement this pairs with.
//
// Every tenant-scoped query MUST run inside runWithTenant(). The wrapper:
//   1. Opens a Postgres transaction (RLS session variables set with SET LOCAL
//      are transaction-scoped — they do not leak across pooled connections).
//   2. Issues `SET LOCAL app.current_tenant_id` (and, when available,
//      app.current_user_id) so Postgres RLS policies can evaluate.
//   3. Runs the caller's callback with a transaction-bound Prisma client.
//
// A query issued against the top-level `prisma` client (outside a
// runWithTenant() transaction) will be rejected by RLS at the database layer
// for every tenant-scoped table, because app.current_tenant_id is unset and
// NULL never satisfies `organization_id = NULL`. This wrapper exists to make
// that the *only* path, not merely the recommended one.
// -----------------------------------------------------------------------------

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TenantContext {
  tenantId: string;
  userId?: string;
}

const tenantStorage = new AsyncLocalStorage<TenantContext>();

function assertUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) {
    throw new Error(`${label} must be a valid UUID, received: ${JSON.stringify(value)}`);
  }
}

/** Returns the tenant context for the currently executing async call chain. Throws outside runWithTenant(). */
export function getCurrentTenantContext(): TenantContext {
  const context = tenantStorage.getStore();
  if (!context) {
    throw new Error(
      "No tenant context established. All tenant-scoped queries must run inside runWithTenant().",
    );
  }
  return context;
}

export interface RunWithTenantOptions {
  /** Max time (ms) the transaction may run before Prisma aborts it. Default: Prisma's own default (5000ms). */
  timeout?: number;
  /** Max time (ms) to wait for a DB connection to become available. */
  maxWait?: number;
}

/**
 * Runs `fn` with a transaction-bound Prisma client that has the Postgres RLS
 * session variables set for `context`. This is the only sanctioned entry
 * point for tenant-scoped reads/writes.
 *
 * `options.timeout` exists for genuinely long-running-but-still-atomic
 * operations (e.g. bulk payroll calculation across many employees — see
 * apps/api/src/payroll/payroll.service.ts). Beyond a certain organization
 * size, a single transaction stops being the right tool at all (see that
 * file's comments on the documented scaling boundary) — this option does
 * not solve unbounded scale, it only avoids Prisma's 5s default becoming a
 * false failure for a legitimately larger-but-still-reasonable batch.
 */
export async function runWithTenant<T>(
  prisma: PrismaClient,
  context: TenantContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: RunWithTenantOptions,
): Promise<T> {
  assertUuid(context.tenantId, "tenantId");
  if (context.userId) {
    assertUuid(context.userId, "userId");
  }

  return tenantStorage.run(context, () =>
    prisma.$transaction(async (tx) => {
      // Values are validated as UUIDs above (not attacker-controlled free
      // text) before interpolation — Postgres's SET command does not accept
      // bind parameters over the extended query protocol, so this is the
      // correct and safe pattern for session-scoped GUCs.
      await tx.$executeRawUnsafe(
        `SET LOCAL app.current_tenant_id = '${context.tenantId}'`,
      );
      if (context.userId) {
        await tx.$executeRawUnsafe(
          `SET LOCAL app.current_user_id = '${context.userId}'`,
        );
      }
      return fn(tx);
    }, options),
  );
}
