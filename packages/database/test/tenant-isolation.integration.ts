// Mandatory tenant-isolation proof. Confirms that a session holding Tenant
// A's context genuinely cannot read or write Tenant B's rows — enforced by
// PostgreSQL Row-Level Security itself, not application logic. This is the
// specific scenario Phase 2's brief calls out as mandatory:
//
//   Tenant A context -> Tenant A query succeeds
//   Tenant A context -> Tenant B record requested -> RLS prevents access
//
// Requires a live Postgres with migrations AND RLS policies already applied:
//   docker compose up -d postgres
//   npm run db:migrate
//   npm run db:rls
//   npm run test:integration --workspace=@nexa/database
//
// Skips cleanly (exit 0, clearly logged) if no database is reachable, so it
// is safe to leave wired into CI without blocking environments that don't
// have Docker available — this run authored the test but could not execute
// it end-to-end for exactly that reason; see the Phase 2 completion report.
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithTenant } from "../src/tenant-context";

const ownerClient = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_DATABASE_URL } },
});
const appClient = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${message}`);
  }
}

async function canConnect(client: PrismaClient): Promise<boolean> {
  try {
    await client.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  if (!(await canConnect(ownerClient)) || !(await canConnect(appClient))) {
    console.log(
      "SKIPPED: no reachable Postgres (DIRECT_DATABASE_URL / DATABASE_URL). " +
        "Run `docker compose up -d postgres && npm run db:migrate && npm run db:rls` first.",
    );
    process.exitCode = 0;
    return;
  }

  console.log("Setting up two isolated tenant fixtures via the owner (RLS-bypassing) connection...");
  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const userAId = randomUUID();

  await ownerClient.organization.createMany({
    data: [
      { id: orgAId, type: "CLIENT", legalName: "Tenant A Integration Test Ltd", displayName: "Tenant A" },
      { id: orgBId, type: "CLIENT", legalName: "Tenant B Integration Test Ltd", displayName: "Tenant B" },
    ],
  });
  await ownerClient.user.create({
    data: {
      id: userAId,
      email: `tenant-a-${randomUUID()}@example.test`,
      passwordHash: "x",
      firstName: "A",
      lastName: "User",
    },
  });
  const employeeA = await ownerClient.employee.create({
    data: {
      organizationId: orgAId,
      employeeNumber: "EMP-A-1",
      firstName: "Alice",
      lastName: "A",
      hireDate: new Date(),
    },
  });
  const employeeB = await ownerClient.employee.create({
    data: {
      organizationId: orgBId,
      employeeNumber: "EMP-B-1",
      firstName: "Bob",
      lastName: "B",
      hireDate: new Date(),
    },
  });

  try {
    console.log("\nScenario 1: Tenant A context can read its own employee row.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.employee.findUnique({ where: { id: employeeA.id } });
      assert(found !== null && found.id === employeeA.id, "Tenant A context reads Tenant A's own employee row");
    });

    console.log("\nScenario 2 (MANDATORY): Tenant A context requests Tenant B's employee row — RLS must block it.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.employee.findUnique({ where: { id: employeeB.id } });
      assert(found === null, "Tenant A context cannot read Tenant B's employee row (RLS returns zero rows)");
    });

    console.log("\nScenario 3: Tenant A context cannot read Tenant B's organization row.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.organization.findUnique({ where: { id: orgBId } });
      assert(found === null, "Tenant A context cannot read Tenant B's organization row");
    });

    console.log("\nScenario 4: Tenant A context cannot UPDATE Tenant B's employee row.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const result = await tx.employee.updateMany({
        where: { id: employeeB.id },
        data: { firstName: "Tampered" },
      });
      assert(result.count === 0, "Tenant A context's UPDATE against Tenant B's row affects zero rows");
    });
    const unchanged = await ownerClient.employee.findUniqueOrThrow({ where: { id: employeeB.id } });
    assert(unchanged.firstName === "Bob", "Tenant B's employee row was not modified by Tenant A's attempted update");

    console.log("\nScenario 5: a query with NO tenant context set (bypassing runWithTenant) sees nothing.");
    await appClient.$transaction(async (tx) => {
      const rows = await tx.employee.findMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      assert(
        rows.length === 0,
        "Querying without SET LOCAL app.current_tenant_id returns zero tenant-scoped rows (fails closed)",
      );
    });

    console.log("\nScenario 6: runWithTenant rejects a malformed tenant id instead of executing the query.");
    let rejectedMalformed = false;
    try {
      await runWithTenant(appClient, { tenantId: "not-a-uuid" }, async (tx) => {
        await tx.employee.findMany();
      });
    } catch {
      rejectedMalformed = true;
    }
    assert(rejectedMalformed, "runWithTenant throws before querying when tenantId is not a valid UUID");
  } finally {
    console.log("\nCleaning up fixtures...");
    await ownerClient.employee.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await ownerClient.user.delete({ where: { id: userAId } });
    await ownerClient.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } });
  }

  console.log(`\n${passed} passed, ${failed} failed.`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main()
  .catch((error: unknown) => {
    console.error("Integration test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await ownerClient.$disconnect();
    await appClient.$disconnect();
  });
