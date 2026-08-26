// Phase 5 brief §26 — the mandatory multi-tenant E2E security scenario,
// exercised through the real, authenticated HTTP API (not direct DB
// queries — that's what packages/database/test/*.integration.ts already
// proves at the RLS layer; this proves the SAME guarantee holds through
// every guard/controller/service in between).
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./helpers/test-app";
import { disconnectFixtureClient, registerOrgAndLoginAdmin } from "./helpers/fixtures";

jest.setTimeout(30000);

describe("Multi-tenant E2E: Tenant A cannot see or touch Tenant B's data, and vice versa", () => {
  let app: INestApplication;
  let tenantAId: string;
  let tenantAToken: string;
  let tenantBId: string;
  let tenantBToken: string;
  let employeeAId: string;
  let employeeBId: string;
  let contractAId: string;
  let contractBId: string;

  beforeAll(async () => {
    app = await createTestApp();

    const tenantA = await registerOrgAndLoginAdmin(app, "tenant-a");
    tenantAId = tenantA.organizationId;
    tenantAToken = tenantA.adminAccessToken;

    const tenantB = await registerOrgAndLoginAdmin(app, "tenant-b");
    tenantBId = tenantB.organizationId;
    tenantBToken = tenantB.adminAccessToken;

    const employeeA = await request(app.getHttpServer())
      .post("/employees")
      .set("Authorization", `Bearer ${tenantAToken}`)
      .send({ employeeNumber: "TENANT-A-001", firstName: "Alice", lastName: "A", hireDate: "2025-01-01" })
      .expect(201);
    employeeAId = employeeA.body.id;

    const employeeB = await request(app.getHttpServer())
      .post("/employees")
      .set("Authorization", `Bearer ${tenantBToken}`)
      .send({ employeeNumber: "TENANT-B-001", firstName: "Bob", lastName: "B", hireDate: "2025-01-01" })
      .expect(201);
    employeeBId = employeeB.body.id;

    const contractA = await request(app.getHttpServer())
      .post("/contracts")
      .set("Authorization", `Bearer ${tenantAToken}`)
      .send({
        employeeId: employeeAId,
        contractType: "PERMANENT_EMPLOYMENT",
        title: "Tenant A Contract",
        effectiveDate: "2025-01-01",
      })
      .expect(201);
    contractAId = contractA.body.id;

    const contractB = await request(app.getHttpServer())
      .post("/contracts")
      .set("Authorization", `Bearer ${tenantBToken}`)
      .send({
        employeeId: employeeBId,
        contractType: "PERMANENT_EMPLOYMENT",
        title: "Tenant B Contract",
        effectiveDate: "2025-01-01",
      })
      .expect(201);
    contractBId = contractB.body.id;
  });

  afterAll(async () => {
    await app.close();
    await disconnectFixtureClient();
  });

  describe("Tenant A: sees its own data, never Tenant B's", () => {
    it("GET /employees lists Employee A, never Employee B", async () => {
      const response = await request(app.getHttpServer())
        .get("/employees")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .expect(200);
      const ids = response.body.map((e: { id: string }) => e.id);
      expect(ids).toContain(employeeAId);
      expect(ids).not.toContain(employeeBId);
    });

    it("GET /contracts lists Contract A, never Contract B", async () => {
      const response = await request(app.getHttpServer())
        .get("/contracts")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .expect(200);
      const ids = response.body.map((c: { id: string }) => c.id);
      expect(ids).toContain(contractAId);
      expect(ids).not.toContain(contractBId);
    });

    it("direct GET of Tenant B's contract by ID returns 404, not the data (IDOR)", async () => {
      await request(app.getHttpServer())
        .get(`/contracts/${contractBId}`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .expect(404);
    });

    it("direct UPDATE of Tenant B's contract by ID returns 404 and does not modify it", async () => {
      await request(app.getHttpServer())
        .patch(`/contracts/${contractBId}`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({ title: "TAMPERED BY TENANT A" })
        .expect(404);

      const stillIntact = await request(app.getHttpServer())
        .get(`/contracts/${contractBId}`)
        .set("Authorization", `Bearer ${tenantBToken}`)
        .expect(200);
      expect(stillIntact.body.title).toBe("Tenant B Contract");
    });

    it("attempting to run compliance evaluation against Tenant B's contract returns 404", async () => {
      await request(app.getHttpServer())
        .post(`/contracts/${contractBId}/compliance/evaluate`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .expect(404);
    });

    it("organization spoofing: switching to an organization Tenant A's admin is not a member of is rejected", async () => {
      await request(app.getHttpServer())
        .post("/auth/switch-organization")
        .set("Authorization", `Bearer ${tenantAToken}`)
        .send({ organizationId: tenantBId })
        .expect(401);
    });
  });

  describe("Tenant B: symmetrically sees its own data, never Tenant A's", () => {
    it("GET /employees lists Employee B, never Employee A", async () => {
      const response = await request(app.getHttpServer())
        .get("/employees")
        .set("Authorization", `Bearer ${tenantBToken}`)
        .expect(200);
      const ids = response.body.map((e: { id: string }) => e.id);
      expect(ids).toContain(employeeBId);
      expect(ids).not.toContain(employeeAId);
    });

    it("direct GET of Tenant A's contract by ID returns 404", async () => {
      await request(app.getHttpServer())
        .get(`/contracts/${contractAId}`)
        .set("Authorization", `Bearer ${tenantBToken}`)
        .expect(404);
    });

    it("direct DELETE-equivalent (void via status update) of Tenant A's contract returns 404", async () => {
      await request(app.getHttpServer())
        .patch(`/contracts/${contractAId}`)
        .set("Authorization", `Bearer ${tenantBToken}`)
        .send({ status: "TERMINATED" })
        .expect(404);
    });
  });

  describe("Cross-tenant AI request: a resource ID from another tenant is rejected the same way", () => {
    it("triggering an AI audit against Tenant B's contract ID while authenticated as Tenant A returns 404 before ever reaching apps/ai", async () => {
      // No fake AI service is even started for this suite — if this
      // request incorrectly resolved the contract, it would fail trying to
      // reach a nonexistent AI_SERVICE_URL instead of 404ing cleanly,
      // which would itself be a signal something upstream is wrong.
      await request(app.getHttpServer())
        .post(`/contracts/${contractBId}/ai-audit`)
        .set("Authorization", `Bearer ${tenantAToken}`)
        .expect(404);
    });
  });
});
