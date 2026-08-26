// Mandatory tenant-isolation proof for the Phase 4 `ai_jobs` table (see
// prisma/rls/005_phase4_ai_jobs.sql). Same pattern as
// tenant-isolation.integration.ts (Phase 2) and
// payroll-contracts-tenant-isolation.integration.ts (Phase 3) — this table
// had no dedicated integration-test coverage before Phase 5. Run via:
//   docker compose up -d postgres
//   npm run db:migrate && npm run db:rls
//   npm run test:integration --workspace=@nexa/database
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runWithTenant } from "../src/tenant-context";
import { reportUnreachableDatabase } from "./_helpers";

const ownerClient = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_DATABASE_URL } } });
const appClient = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });

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
    reportUnreachableDatabase("ai-jobs-tenant-isolation.integration.ts");
    return;
  }

  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const userAId = randomUUID();
  const userBId = randomUUID();

  console.log("Setting up two tenant fixtures with an AiJob each...");
  await ownerClient.organization.createMany({
    data: [
      { id: orgAId, type: "CLIENT", legalName: "Tenant A Ltd", displayName: "Tenant A" },
      { id: orgBId, type: "CLIENT", legalName: "Tenant B Ltd", displayName: "Tenant B" },
    ],
  });
  await ownerClient.user.createMany({
    data: [
      { id: userAId, email: `tenant-a-${randomUUID()}@example.test`, passwordHash: "x", firstName: "A", lastName: "User" },
      { id: userBId, email: `tenant-b-${randomUUID()}@example.test`, passwordHash: "x", firstName: "B", lastName: "User" },
    ],
  });

  const jobB = await ownerClient.aiJob.create({
    data: {
      organizationId: orgBId,
      requestedByUserId: userBId,
      agentType: "CONTRACT_AUDIT",
      status: "SUCCEEDED",
      promptVersion: "contract-audit-v1",
      resultJson: { summary: "Tenant B's AI audit result", overall_assessment: "LOOKS_SOUND", findings: [] },
    },
  });

  try {
    console.log("\nScenario 1 (MANDATORY): Tenant A context cannot read Tenant B's AiJob.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.aiJob.findUnique({ where: { id: jobB.id } });
      assert(found === null, "Tenant A context cannot read Tenant B's ai_jobs row");
    });

    console.log("\nScenario 2: Tenant A cannot list Tenant B's AiJob via a broad, unfiltered query either.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const jobs = await tx.aiJob.findMany({});
      assert(
        jobs.every((j) => j.organizationId === orgAId),
        "A broad (unfiltered) aiJob.findMany from Tenant A context returns zero Tenant B rows",
      );
    });

    console.log("\nScenario 3 (MANDATORY): Tenant A context cannot UPDATE Tenant B's AiJob.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const result = await tx.aiJob.updateMany({ where: { id: jobB.id }, data: { status: "FAILED" } });
      assert(result.count === 0, "Tenant A context's UPDATE against Tenant B's ai_jobs row affects zero rows");
    });
    const stillSucceeded = await ownerClient.aiJob.findUniqueOrThrow({ where: { id: jobB.id } });
    assert(stillSucceeded.status === "SUCCEEDED", "Tenant B's AiJob status was not modified by Tenant A's attempted update");

    console.log("\nScenario 4 (MANDATORY): Tenant A context cannot DELETE Tenant B's AiJob.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const result = await tx.aiJob.deleteMany({ where: { id: jobB.id } });
      assert(result.count === 0, "Tenant A context's DELETE against Tenant B's ai_jobs row affects zero rows");
    });
    const stillThere = await ownerClient.aiJob.findUnique({ where: { id: jobB.id } });
    assert(stillThere !== null, "Tenant B's AiJob still exists after Tenant A's attempted delete");

    console.log("\nScenario 5: Tenant B's own context CAN read its own AiJob and see its AI result (sanity check).");
    await runWithTenant(appClient, { tenantId: orgBId }, async (tx) => {
      const found = await tx.aiJob.findUnique({ where: { id: jobB.id } });
      assert(found !== null && found.status === "SUCCEEDED", "Tenant B context reads its own AiJob");
    });

    console.log("\nScenario 6: a query with NO tenant context set sees no ai_jobs rows at all (fails closed).");
    await appClient.$transaction(async (tx) => {
      const rows = await tx.aiJob.findMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
      assert(rows.length === 0, "Querying ai_jobs without SET LOCAL app.current_tenant_id returns zero rows");
    });
  } finally {
    console.log("\nCleaning up fixtures...");
    await ownerClient.aiJob.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await ownerClient.user.deleteMany({ where: { id: { in: [userAId, userBId] } } });
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
