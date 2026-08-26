// Mandatory tenant-isolation proof for Phase 3's new tables: payroll_runs,
// payroll_records (now keyed off payroll_run_id), contracts, and
// compliance_evaluations. Same pattern and same honesty caveat as
// tenant-isolation.integration.ts (Phase 2): requires a live Postgres with
// migrations + RLS applied, and was authored but NOT executed in this
// environment (no Docker/Postgres available) — see the Phase 3 completion
// report. Run via:
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
    reportUnreachableDatabase("payroll-contracts-tenant-isolation.integration.ts");
    return;
  }

  const orgAId = randomUUID();
  const orgBId = randomUUID();
  const userAId = randomUUID();
  const roleId = randomUUID();

  console.log("Setting up two tenant fixtures with payroll runs and contracts...");
  await ownerClient.organization.createMany({
    data: [
      { id: orgAId, type: "CLIENT", legalName: "Tenant A Ltd", displayName: "Tenant A" },
      { id: orgBId, type: "CLIENT", legalName: "Tenant B Ltd", displayName: "Tenant B" },
    ],
  });
  await ownerClient.user.create({
    data: { id: userAId, email: `tenant-a-${randomUUID()}@example.test`, passwordHash: "x", firstName: "A", lastName: "User" },
  });
  // Roles/permissions are global reference data — reuse the seeded
  // client_admin role if present, otherwise create a throwaway one so this
  // test doesn't depend on `db:seed` having run first.
  const existingRole = await ownerClient.role.findFirst({ where: { key: "client_admin" } });
  const roleIdToUse = existingRole?.id ?? (await ownerClient.role.create({ data: { id: roleId, key: `test-role-${randomUUID()}`, name: "Test Role" } })).id;

  const employeeA = await ownerClient.employee.create({
    data: { organizationId: orgAId, employeeNumber: "EMP-A-1", firstName: "Alice", lastName: "A", hireDate: new Date() },
  });
  const employeeB = await ownerClient.employee.create({
    data: { organizationId: orgBId, employeeNumber: "EMP-B-1", firstName: "Bob", lastName: "B", hireDate: new Date() },
  });

  const runB = await ownerClient.payrollRun.create({
    data: {
      organizationId: orgBId,
      payrollPeriodStart: new Date("2026-01-01"),
      payrollPeriodEnd: new Date("2026-01-31"),
      currency: "KES",
      createdByUserId: userAId, // arbitrary — FK just needs a valid user
    },
  });
  const contractB = await ownerClient.contract.create({
    data: {
      organizationId: orgBId,
      employeeId: employeeB.id,
      contractType: "PERMANENT_EMPLOYMENT",
      title: "Tenant B Contract",
      effectiveDate: new Date("2026-01-01"),
    },
  });

  try {
    console.log("\nScenario 1 (MANDATORY): Tenant A context cannot read Tenant B's payroll run.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.payrollRun.findUnique({ where: { id: runB.id } });
      assert(found === null, "Tenant A context cannot read Tenant B's payroll run");
    });

    console.log("\nScenario 2 (MANDATORY): Tenant A context cannot read Tenant B's contract.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.contract.findUnique({ where: { id: contractB.id } });
      assert(found === null, "Tenant A context cannot read Tenant B's contract");
    });

    console.log("\nScenario 3: Tenant A cannot list Tenant B's payroll runs via a broad query either.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const runs = await tx.payrollRun.findMany({});
      assert(
        runs.every((r) => r.organizationId === orgAId),
        "A broad (unfiltered) payrollRun.findMany from Tenant A context returns zero Tenant B rows",
      );
    });

    console.log("\nScenario 4: Tenant A cannot approve/finalize Tenant B's payroll run via UPDATE.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const result = await tx.payrollRun.updateMany({
        where: { id: runB.id },
        data: { status: "APPROVED" },
      });
      assert(result.count === 0, "Tenant A context's UPDATE against Tenant B's payroll run affects zero rows");
    });
    const stillDraft = await ownerClient.payrollRun.findUniqueOrThrow({ where: { id: runB.id } });
    assert(stillDraft.status === "DRAFT", "Tenant B's payroll run status was not modified by Tenant A's attempted update");

    console.log("\nScenario 5: Tenant B's own context CAN read its own payroll run and contract (sanity check).");
    await runWithTenant(appClient, { tenantId: orgBId }, async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runB.id } });
      const contract = await tx.contract.findUnique({ where: { id: contractB.id } });
      assert(run !== null, "Tenant B context reads its own payroll run");
      assert(contract !== null, "Tenant B context reads its own contract");
    });

    console.log("\nScenario 6: compliance_evaluations are isolated the same way.");
    const evaluationB = await ownerClient.complianceEvaluation.create({
      data: {
        organizationId: orgBId,
        subjectType: "CONTRACT",
        contractId: contractB.id,
        status: "PASS",
        findings: { violations: [] },
        ruleEngineVersion: "1.0.0",
      },
    });
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const found = await tx.complianceEvaluation.findUnique({ where: { id: evaluationB.id } });
      assert(found === null, "Tenant A context cannot read Tenant B's compliance evaluation");
    });

    console.log("\nScenario 7 (MANDATORY): Tenant A context cannot DELETE Tenant B's contract.");
    await runWithTenant(appClient, { tenantId: orgAId }, async (tx) => {
      const result = await tx.contract.deleteMany({ where: { id: contractB.id } });
      assert(result.count === 0, "Tenant A context's DELETE against Tenant B's contract affects zero rows");
    });
    const contractStillThere = await ownerClient.contract.findUnique({ where: { id: contractB.id } });
    assert(contractStillThere !== null, "Tenant B's contract still exists after Tenant A's attempted delete");
  } finally {
    console.log("\nCleaning up fixtures...");
    await ownerClient.complianceEvaluation.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await ownerClient.payrollRun.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await ownerClient.contract.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await ownerClient.employee.deleteMany({ where: { organizationId: { in: [orgAId, orgBId] } } });
    await ownerClient.user.delete({ where: { id: userAId } });
    if (!existingRole) {
      await ownerClient.role.delete({ where: { id: roleIdToUse } });
    }
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
