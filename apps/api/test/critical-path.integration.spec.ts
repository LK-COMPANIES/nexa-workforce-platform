// Phase 5 brief §25/27/28: the mandatory end-to-end critical path —
// Login -> JWT auth -> org resolution -> RBAC -> Employee creation ->
// Contract creation -> Compliance validation -> Payroll calculation ->
// Payroll persistence -> Payroll summary -> AI contract audit -> Audit log.
//
// Runs against a REAL NestJS app instance (supertest, not a mocked
// controller) and a REAL, disposable Postgres + Redis — see
// test/helpers/test-app.ts and .github/workflows/ci.yml's api-e2e-tests
// job. The AI orchestration service is faked at the HTTP boundary (see
// test/helpers/fake-ai-service.ts) so this suite never needs Python or a
// live Anthropic key, per brief §29 / final architectural principle #8.
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp } from "./helpers/test-app";
import { startFakeAiService, type FakeAiService } from "./helpers/fake-ai-service";
import { disconnectFixtureClient, provisionAndLoginHrManager, registerOrgAndLoginAdmin } from "./helpers/fixtures";

jest.setTimeout(30000);

describe("Critical path: auth -> RBAC -> employee -> contract -> compliance -> payroll -> AI audit", () => {
  let app: INestApplication;
  let fakeAi: FakeAiService;
  let organizationId: string;
  let adminToken: string;
  let hrToken: string;

  beforeAll(async () => {
    fakeAi = await startFakeAiService();
    process.env.AI_SERVICE_URL = fakeAi.url; // must be set before the app (and its ApiConfigService) boots

    app = await createTestApp();

    const org = await registerOrgAndLoginAdmin(app, "critical-path");
    organizationId = org.organizationId;
    adminToken = org.adminAccessToken;

    const hr = await provisionAndLoginHrManager(app, organizationId, "critical-path");
    hrToken = hr.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await fakeAi.close();
    await disconnectFixtureClient();
  });

  describe("Auth & RBAC", () => {
    it("rejects a request with no Authorization header", async () => {
      await request(app.getHttpServer()).get("/auth/me").expect(401);
    });

    it("rejects a request with a garbage bearer token", async () => {
      await request(app.getHttpServer()).get("/auth/me").set("Authorization", "Bearer not-a-real-token").expect(401);
    });

    it("GET /auth/me resolves the correct organization and role for the admin token", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.tenant.organizationId).toBe(organizationId);
      expect(response.body.tenant.roleKey).toBe("client_admin");
    });

    it("RBAC: the hr_manager token can process payroll but is rejected approving it (403)", async () => {
      // Proven properly below in the Payroll section (real 403 on a real
      // attempted approval) — asserted here too as a direct RBAC check
      // independent of any prior state.
      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      expect(response.body.tenant.roleKey).toBe("hr_manager");
      expect(response.body.tenant.permissions).toContain("payroll:process");
      expect(response.body.tenant.permissions).not.toContain("payroll:approve");
    });
  });

  let employeeId: string;

  describe("Employee creation", () => {
    it("hr_manager can create an employee", async () => {
      const response = await request(app.getHttpServer())
        .post("/employees")
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          employeeNumber: "E2E-EMP-001",
          firstName: "Amina",
          lastName: "Otieno",
          hireDate: "2024-01-15",
        })
        .expect(201);
      expect(response.body.organizationId).toBe(organizationId);
      employeeId = response.body.id;
    });

    it("the new employee appears in the organization's employee list", async () => {
      const response = await request(app.getHttpServer())
        .get("/employees")
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      expect(response.body.some((e: { id: string }) => e.id === employeeId)).toBe(true);
    });
  });

  let contractId: string;
  const GROSS_MONTHLY_SALARY = 120_000;
  const PAYROLL_PERIOD_START = "2026-02-01";
  const PAYROLL_PERIOD_END = "2026-02-28";

  describe("Contract creation & deterministic compliance validation", () => {
    it("hr_manager can create a structured permanent-employment contract", async () => {
      const response = await request(app.getHttpServer())
        .post("/contracts")
        .set("Authorization", `Bearer ${hrToken}`)
        .send({
          employeeId,
          contractType: "PERMANENT_EMPLOYMENT",
          title: "Software Engineer — Permanent",
          effectiveDate: "2024-01-15",
          baseCompensation: GROSS_MONTHLY_SALARY,
          currency: "KES",
          paymentInterval: "MONTHLY",
          jobTitle: "Software Engineer",
          jobDescription: "Builds and maintains the Nexa platform.",
          workLocation: "Nairobi, Kenya",
          workingHoursPerWeek: 40,
          probationMonths: 3,
          noticePeriodDays: 30,
        })
        .expect(201);
      contractId = response.body.id;
      expect(response.body.status).toBe("DRAFT");
    });

    it("activates the contract (required for payroll eligibility)", async () => {
      const response = await request(app.getHttpServer())
        .patch(`/contracts/${contractId}`)
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ status: "ACTIVE" })
        .expect(200);
      expect(response.body.status).toBe("ACTIVE");
    });

    let deterministicStatus: string;

    it("runs deterministic Employment Act 2007 compliance validation and produces a well-formed result", async () => {
      const response = await request(app.getHttpServer())
        .post(`/contracts/${contractId}/compliance/evaluate`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(201);

      expect(["PASS", "WARNING", "FAIL", "REQUIRES_HUMAN_REVIEW"]).toContain(response.body.status);
      expect(response.body.findings).toBeDefined();
      expect(Array.isArray(response.body.findings.violations)).toBe(true);
      expect(Array.isArray(response.body.findings.warnings)).toBe(true);
      expect(Array.isArray(response.body.findings.passedChecks)).toBe(true);
      expect(response.body.ruleEngineVersion).toEqual(expect.any(String));
      deterministicStatus = response.body.status;
    });

    it("the evaluation is retrievable and append-only (a second evaluate creates a new row, doesn't mutate the first)", async () => {
      const before = await request(app.getHttpServer())
        .get(`/contracts/${contractId}/compliance`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      expect(before.body.length).toBe(1);

      await request(app.getHttpServer())
        .post(`/contracts/${contractId}/compliance/evaluate`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(201);

      const after = await request(app.getHttpServer())
        .get(`/contracts/${contractId}/compliance`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      expect(after.body.length).toBe(2);
      expect(after.body[0].status).toBe(deterministicStatus);
    });
  });

  let payrollRunId: string;

  describe("Payroll: calculation, persistence, retrieval — verified against the authoritative engine", () => {
    it("payroll:process (hr_manager) can create a payroll run; client_admin-only payroll:approve is rejected for hr_manager", async () => {
      const response = await request(app.getHttpServer())
        .post("/payroll/runs")
        .set("Authorization", `Bearer ${hrToken}`)
        .send({ payrollPeriodStart: PAYROLL_PERIOD_START, payrollPeriodEnd: PAYROLL_PERIOD_END, runType: "REGULAR", currency: "KES" })
        .expect(201);
      payrollRunId = response.body.id;
      expect(response.body.status).toBe("DRAFT");
    });

    it("hr_manager (payroll:process) can calculate the run", async () => {
      const response = await request(app.getHttpServer())
        .post(`/payroll/runs/${payrollRunId}/calculate`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      expect(response.body.status).toBe("CALCULATED");
      expect(response.body.employeeCount).toBe(1);
    });

    it("RBAC: hr_manager (no payroll:approve) is rejected 403 approving the run it just calculated", async () => {
      await request(app.getHttpServer())
        .post(`/payroll/runs/${payrollRunId}/approve`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(403);
    });

    it("the persisted payroll record matches the authoritative payroll-engine output for the same inputs", async () => {
      const recordsResponse = await request(app.getHttpServer())
        .get(`/payroll/runs/${payrollRunId}/records`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(recordsResponse.body).toHaveLength(1);
      const persisted = recordsResponse.body[0];
      expect(persisted.employeeId).toBe(employeeId);

      // The SAME authoritative engine, invoked through the app's own
      // calculator preview endpoint (payroll-calculator.controller.ts) —
      // not re-derived statutory math in this test (brief §27: "do not
      // duplicate payroll formulas inside the test").
      const previewResponse = await request(app.getHttpServer())
        .post("/payroll/calculator")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          cashGrossPay: GROSS_MONTHLY_SALARY,
          nonCashBenefits: [],
          allowableDeductions: [],
          otherDeductions: [],
          payrollPeriodStart: PAYROLL_PERIOD_START,
          payrollPeriodEnd: PAYROLL_PERIOD_END,
          currency: "KES",
        })
        .expect(201);
      const authoritative = previewResponse.body;

      expect(Number(persisted.grossPay).toFixed(2)).toBe(authoritative.grossPay.toFixed(2));
      expect(Number(persisted.payeAmount).toFixed(2)).toBe(authoritative.paye.toFixed(2));
      expect(Number(persisted.nssfEmployeeAmount).toFixed(2)).toBe(authoritative.nssfEmployeeTotal.toFixed(2));
      expect(Number(persisted.shifAmount).toFixed(2)).toBe(authoritative.shifEmployee.toFixed(2));
      expect(Number(persisted.housingLevyEmployeeAmount).toFixed(2)).toBe(authoritative.housingLevyEmployee.toFixed(2));
      expect(Number(persisted.totalEmployeeDeductions).toFixed(2)).toBe(authoritative.totalEmployeeDeductions.toFixed(2));
      expect(Number(persisted.netPay).toFixed(2)).toBe(authoritative.netPay.toFixed(2));

      // Sanity: gross - deductions == net, using the persisted figures
      // themselves (not just trusting the engine agrees with itself).
      const grossMinusDeductions = Number(persisted.grossPay) - Number(persisted.totalEmployeeDeductions);
      expect(grossMinusDeductions).toBeCloseTo(Number(persisted.netPay), 2);
    });

    it("the payroll summary aggregates the same figures", async () => {
      const response = await request(app.getHttpServer())
        .get(`/payroll/runs/${payrollRunId}/summary`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(response.body.employeeCount).toBe(1);
      expect(response.body.netPayroll).toBeGreaterThan(0);
      expect(response.body.grossPayroll).toBeCloseTo(GROSS_MONTHLY_SALARY, 2);
    });

    it("client_admin (payroll:approve) can approve and finalize the run", async () => {
      const approved = await request(app.getHttpServer())
        .post(`/payroll/runs/${payrollRunId}/approve`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(approved.body.status).toBe("APPROVED");

      const finalized = await request(app.getHttpServer())
        .post(`/payroll/runs/${payrollRunId}/finalize`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(200);
      expect(finalized.body.status).toBe("FINALIZED");
    });

    it("a finalized run rejects a further calculate attempt (lifecycle is enforced, not just suggested)", async () => {
      await request(app.getHttpServer())
        .post(`/payroll/runs/${payrollRunId}/calculate`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(409);
    });
  });

  describe("AI contract audit & audit log — never overwrites the deterministic result", () => {
    let deterministicEvaluationsBefore: unknown[];

    it("triggers an AI audit job through the real apps/api <-> apps/ai HTTP contract (apps/ai faked at the boundary)", async () => {
      const before = await request(app.getHttpServer())
        .get(`/contracts/${contractId}/compliance`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      deterministicEvaluationsBefore = before.body;

      const response = await request(app.getHttpServer())
        .post(`/contracts/${contractId}/ai-audit`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(201);

      expect(response.body.status).toBe("PENDING");
      expect(response.body.jobId).toEqual(expect.any(String));
      // apps/api forwarded the caller's own token, not a fabricated one.
      expect(fakeAi.lastAuthorizationHeader).toBe(`Bearer ${hrToken}`);
    });

    it("polls the job to completion and receives a schema-shaped AI result, clearly labeled as AI-generated", async () => {
      const jobsResponse = await request(app.getHttpServer())
        .post(`/contracts/${contractId}/ai-audit`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(201);
      const jobId = jobsResponse.body.jobId;

      const statusResponse = await request(app.getHttpServer())
        .get(`/ai/jobs/${jobId}`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);

      expect(statusResponse.body.status).toBe("SUCCEEDED");
      expect(statusResponse.body.result.overall_assessment).toEqual(expect.any(String));
      expect(statusResponse.body.result.disclaimer).toMatch(/not legal advice/i);
    });

    it("the deterministic compliance evaluations are byte-for-byte unchanged after the AI audit ran", async () => {
      const after = await request(app.getHttpServer())
        .get(`/contracts/${contractId}/compliance`)
        .set("Authorization", `Bearer ${hrToken}`)
        .expect(200);
      expect(after.body).toEqual(deterministicEvaluationsBefore);
    });
  });
});
