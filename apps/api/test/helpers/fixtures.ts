import { randomUUID } from "node:crypto";
import type { INestApplication } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@nexa/auth";
import request from "supertest";

// A password satisfying assertPasswordPolicy (packages/auth) — 12+
// characters, not on the common-password denylist.
export const TEST_PASSWORD = "Correct-Horse-Battery-Staple-9";

// The owner (RLS-bypassing) connection, used ONLY for fixture setup that
// has no corresponding API endpoint yet — e.g. provisioning a second user
// with a specific non-admin role, since there is no "invite a member"
// endpoint in this API surface (see docs/production-readiness.md's known
// limitations). Every actual assertion in these tests goes through the
// real HTTP API, never this client.
const ownerClient = new PrismaClient({ datasources: { db: { url: process.env.DIRECT_DATABASE_URL } } });

export async function disconnectFixtureClient(): Promise<void> {
  await ownerClient.$disconnect();
}

export interface RegisteredOrg {
  organizationId: string;
  adminEmail: string;
  adminAccessToken: string;
}

// Registers a brand-new CLIENT organization + its client_admin user via
// the REAL POST /auth/register endpoint, then logs in via the REAL
// POST /auth/login endpoint to obtain a genuine, correctly-signed JWT —
// exactly the path a real user goes through, not a fabricated token.
export async function registerOrgAndLoginAdmin(app: INestApplication, label: string): Promise<RegisteredOrg> {
  const adminEmail = `${label}-admin-${randomUUID()}@example.test`;

  const registerResponse = await request(app.getHttpServer())
    .post("/auth/register")
    .send({
      organization: { legalName: `${label} Ltd`, displayName: label, countryCode: "KE" },
      admin: { email: adminEmail, password: TEST_PASSWORD, firstName: "Admin", lastName: label },
    })
    .expect(201);

  const organizationId: string = registerResponse.body.organization.id;

  const loginResponse = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email: adminEmail, password: TEST_PASSWORD, organizationId })
    .expect(200);

  return { organizationId, adminEmail, adminAccessToken: loginResponse.body.accessToken };
}

// Provisions a second user with the `hr_manager` role in an already-
// registered organization, then logs them in via the real endpoint. Direct
// DB writes (via the owner client) are used only because no membership-
// invite API exists yet; login itself is real. hr_manager exists
// specifically to exercise separation-of-duties: it can create/process
// payroll (payroll:process) but cannot approve/finalize it
// (payroll:approve — client_admin-only), matching
// packages/auth/src/role-permissions.ts exactly.
export async function provisionAndLoginHrManager(
  app: INestApplication,
  organizationId: string,
  label: string,
): Promise<{ email: string; accessToken: string }> {
  const email = `${label}-hr-${randomUUID()}@example.test`;
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const role = await ownerClient.role.findUniqueOrThrow({ where: { key: "hr_manager" } });

  const user = await ownerClient.user.create({
    data: { email, passwordHash, firstName: "HR", lastName: label },
  });
  await ownerClient.organizationMembership.create({
    data: { userId: user.id, organizationId, roleId: role.id, status: "ACTIVE", joinedAt: new Date() },
  });

  const loginResponse = await request(app.getHttpServer())
    .post("/auth/login")
    .send({ email, password: TEST_PASSWORD, organizationId })
    .expect(200);

  return { email, accessToken: loginResponse.body.accessToken };
}
