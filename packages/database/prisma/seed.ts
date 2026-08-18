import { PrismaClient } from "@prisma/client";
import {
  ENGAGEMENT_TYPE_KEYS,
  PERMISSION_KEYS,
  SYSTEM_ROLE_KEYS,
  type EngagementTypeKey,
  type PermissionKey,
  type SystemRoleKey,
} from "@nexa/types";
import { ROLE_PERMISSION_MAP, assertPasswordPolicy, hashPassword } from "@nexa/auth";
import { loadBootstrapAdminConfig } from "@nexa/config";
import { COMPLIANCE_RULE_DEFINITION_SCHEMAS, STATUTORY_RULE_DEFINITION_SCHEMAS } from "@nexa/validation";
import type { ComplianceRuleType } from "@nexa/types";

// Seeds platform-foundational reference data ONLY: system roles and their
// permission grants, engagement-type reference data, the Kenya statutory
// jurisdiction + versioned 2026 statutory rules, the Nexa root organization,
// and (only when explicitly enabled) the initial platform super-admin
// account. This is NOT demo/sample data — every row here is real data the
// platform depends on to function.
//
// Safety: every write below is an upsert keyed on a stable natural key
// (a `key`/`email`/`countryCode`/(jurisdiction,ruleType,effectiveFrom) —
// never a bare create, and there is no deleteMany/truncate anywhere in this
// file. Rerunning this script is safe and produces no duplicates.
//
// Connects via DIRECT_DATABASE_URL (the privileged owner connection) rather
// than DATABASE_URL (the RLS-constrained nexa_app role): this data has no
// tenant context to establish (it's either global reference data or the
// Nexa root organization/admin account itself being created for the first
// time), which the RLS-constrained role cannot do by design.
const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL },
  },
});

const NEXA_ROOT_ORGANIZATION_ID = "00000000-0000-4000-8000-000000000001";

function assertSafeToRun(): void {
  const nodeEnv = process.env.NODE_ENV ?? "development";
  if (nodeEnv === "production" && process.env.SEED_CONFIRM_PRODUCTION !== "true") {
    throw new Error(
      "Refusing to run against NODE_ENV=production without SEED_CONFIRM_PRODUCTION=true. " +
        "This script only performs idempotent upserts (no deleteMany/truncate), but running " +
        "it against production unintentionally is still a mistake worth requiring an explicit " +
        "confirmation for.",
    );
  }
}

const ROLE_NAMES: Record<SystemRoleKey, string> = {
  nexa_super_admin: "Nexa Super Admin",
  client_admin: "Client Admin",
  hr_manager: "HR Manager",
  bpo_supervisor: "BPO Supervisor",
  bpo_agent: "BPO Agent",
  employee: "Employee",
};

const PERMISSION_DESCRIPTIONS: Record<PermissionKey, string> = {
  "organization:read": "View organization profile and settings",
  "organization:update": "Modify organization profile and settings",
  "organization:manage_members": "Invite, remove, or change roles of organization members",
  "user:read": "View user accounts",
  "user:create": "Invite/create new user accounts",
  "user:update": "Modify user account details",
  "user:disable": "Deactivate a user account",
  "employee:read": "View employee records",
  "employee:create": "Create employee records",
  "employee:update": "Modify employee records",
  "contract:read": "View contracts",
  "contract:create": "Create contracts",
  "contract:update": "Modify contracts",
  "contract:approve": "Approve contracts",
  "payroll:read": "View payroll records",
  "payroll:process": "Run payroll calculations",
  "payroll:approve": "Approve payroll records for payment",
  "audit:read": "View the authentication/security audit trail",
  "ai_audit:read": "View AI audit log entries",
  "ai_audit:review": "Record a human review decision on an AI audit log entry",
  "platform:manage_organizations": "Create, modify, or deactivate any organization on the platform",
  "platform:manage_roles": "Create or modify system roles and permission assignments",
};

const ENGAGEMENT_TYPE_DETAILS: Record<EngagementTypeKey, { name: string; description: string }> = {
  PROJECT_BASED_CONSULTING: {
    name: "Project-Based Consulting",
    description: "A defined-scope, defined-timeline consulting engagement delivering a specific outcome.",
  },
  MONTHLY_RETAINER: {
    name: "Monthly Retainer",
    description: "An ongoing advisory/service relationship billed on a recurring monthly basis.",
  },
  FULLY_MANAGED_SERVICES: {
    name: "Fully Managed Services",
    description:
      "Nexa operates an entire workforce function (e.g. a BPO campaign or full HR function) on the client's behalf.",
  },
  ANNUAL_AUDIT_COMPLIANCE: {
    name: "Annual Audit & Compliance",
    description: "A recurring annual engagement focused on HR audit and statutory compliance review.",
  },
  TECHNOLOGY_IMPLEMENTATION_SUPPORT: {
    name: "Technology Implementation & Support",
    description: "Implementation and ongoing support of HR technology systems for the client.",
  },
};

async function seedPermissionsAndRoles(): Promise<void> {
  console.log("Seeding permissions...");
  const permissionRecords = await Promise.all(
    PERMISSION_KEYS.map((key) =>
      prisma.permission.upsert({
        where: { key },
        update: { description: PERMISSION_DESCRIPTIONS[key] },
        create: { key, description: PERMISSION_DESCRIPTIONS[key] },
      }),
    ),
  );
  const permissionIdByKey = new Map(permissionRecords.map((permission) => [permission.key, permission.id]));

  console.log("Seeding system roles and role -> permission grants...");
  for (const roleKey of SYSTEM_ROLE_KEYS) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: { name: ROLE_NAMES[roleKey], isSystemRole: true },
      create: { key: roleKey, name: ROLE_NAMES[roleKey], isSystemRole: true },
    });

    for (const permissionKey of ROLE_PERMISSION_MAP[roleKey]) {
      const permissionId = permissionIdByKey.get(permissionKey);
      if (!permissionId) {
        throw new Error(`Permission "${permissionKey}" referenced by role "${roleKey}" was not seeded.`);
      }
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
}

async function seedEngagementTypes(): Promise<void> {
  console.log("Seeding engagement type reference data...");
  for (const key of ENGAGEMENT_TYPE_KEYS) {
    const details = ENGAGEMENT_TYPE_DETAILS[key];
    await prisma.engagementType.upsert({
      where: { key },
      update: { name: details.name, description: details.description, isActive: true },
      create: { key, name: details.name, description: details.description },
    });
  }
}

// -----------------------------------------------------------------------------
// Kenya statutory reference data — 2026.
//
// IMPORTANT — provenance and confidence: these figures were established via
// web research performed during this seed's authorship (2026-08-18), cross-
// checked against multiple independent secondary sources (payroll/HR
// calculator sites) that were consistent with each other and with general
// knowledge of the relevant statutes. Kenya Revenue Authority's own public
// notice page returned a STALE (2018-era) table when checked directly, and a
// specific gazette notice number could not be located for the February 2026
// NSSF step or the exact Housing Levy/SHIF commencement dates — those
// effective dates are therefore approximate. This is NOT a substitute for
// legal/compliance sign-off: verify against a primary KRA/NSSF/SHA/Kenya
// Gazette source before this data drives a real payroll run. See
// sourceReference on each row for the specific citations used.
// -----------------------------------------------------------------------------

interface StatutorySeedRow {
  ruleType: "PAYE" | "NSSF" | "SHIF" | "HOUSING_LEVY";
  taxYear: number;
  effectiveFrom: string; // ISO date
  ruleDefinition: unknown;
  sourceReference: string;
}

const KENYA_STATUTORY_SEED_2026: StatutorySeedRow[] = [
  {
    ruleType: "PAYE",
    taxYear: 2026,
    effectiveFrom: "2023-07-01",
    ruleDefinition: {
      bands: [
        { monthlyFrom: 0, monthlyTo: 24000, rate: 0.1 },
        { monthlyFrom: 24000.01, monthlyTo: 32333, rate: 0.25 },
        { monthlyFrom: 32333.01, monthlyTo: 500000, rate: 0.3 },
        { monthlyFrom: 500000.01, monthlyTo: 800000, rate: 0.325 },
        { monthlyFrom: 800000.01, monthlyTo: null, rate: 0.35 },
      ],
      personalReliefMonthly: 2400,
      personalReliefAnnual: 28800,
      appliesTo: "EMPLOYEE",
    },
    sourceReference:
      "Finance Act 2023 (Kenya), effective 1 July 2023. Corroborated via smarthr.co.ke/blog/kra-paye-tax-bands-kenya-2026, payecalculator.co.ke, and multiple independent 2026 payroll guides (research performed 2026-08-18). KRA's own public notice page (kra.go.ke/news-center/public-notices/392-...) displayed a STALE pre-2023 band table when checked directly and could not be used as primary citation — confirm against a current KRA notice/gazette before this drives live payroll.",
  },
  {
    ruleType: "NSSF",
    taxYear: 2026,
    effectiveFrom: "2026-02-01",
    ruleDefinition: {
      tiers: [
        {
          tier: "I",
          lowerLimit: 0,
          upperLimit: 9000,
          employeeRate: 0.06,
          employerRate: 0.06,
          employeeCap: 540,
          employerCap: 540,
        },
        {
          tier: "II",
          lowerLimit: 9000,
          upperLimit: 108000,
          employeeRate: 0.06,
          employerRate: 0.06,
          employeeCap: 5940,
          employerCap: 5940,
        },
      ],
      maxEmployeeContribution: 6480,
      maxEmployerContribution: 6480,
      appliesTo: "EMPLOYEE_AND_EMPLOYER",
    },
    sourceReference:
      "NSSF Act, 2013 (Kenya) phased implementation schedule, February 2026 step (LEL 9,000 / UEL 108,000). Sourced from CM Advocates LLP legal update (cmadvocates.com/blog/understanding-the-updated-nssf-contributions-in-kenya-effective-february-2026), corroborated by multiple independent 2026 payroll guides (research performed 2026-08-18). No specific 2026 NSSF Board gazette notice number was located — confirm against the official gazette notice before this drives live payroll.",
  },
  {
    ruleType: "SHIF",
    taxYear: 2026,
    effectiveFrom: "2024-10-01",
    ruleDefinition: {
      rate: 0.0275,
      minimumMonthlyContribution: null,
      cap: null,
      appliesTo: "EMPLOYEE",
    },
    sourceReference:
      "Social Health Insurance Act, 2023 (Kenya) / SHIF, rate unchanged into 2026 per smarthr.co.ke/guides/shif-rates-kenya and multiple independent 2026 payroll guides (research performed 2026-08-18). Effective date (2024-10-01) is approximate, based on general knowledge of SHIF's commencement replacing NHIF, not confirmed against a primary SHA/Gazette document during this research pass — confirm before this drives live payroll.",
  },
  {
    ruleType: "HOUSING_LEVY",
    taxYear: 2026,
    effectiveFrom: "2024-03-19",
    ruleDefinition: {
      employeeRate: 0.015,
      employerRate: 0.015,
      cap: null,
      appliesTo: "EMPLOYEE_AND_EMPLOYER",
    },
    sourceReference:
      "Affordable Housing Act, 2024 (Kenya), rate unchanged into 2026 per netpaykenya.org/calculators/housing-levy, employsome.com/hire/kenya/affordable-housing-levy-kenya, and multiple independent 2026 payroll guides (research performed 2026-08-18). Effective date (2024-03-19) is approximate, based on general knowledge of the Act's commencement, not confirmed against a primary Gazette document during this research pass — confirm before this drives live payroll.",
  },
];

async function seedKenyaStatutoryData(): Promise<void> {
  console.log("Seeding Kenya statutory jurisdiction...");
  const jurisdiction = await prisma.statutoryJurisdiction.upsert({
    where: { countryCode: "KE" },
    update: {},
    create: { countryCode: "KE", name: "Kenya" },
  });

  console.log("Seeding Kenya 2026 statutory rule versions (PAYE, NSSF, SHIF, Housing Levy)...");
  for (const row of KENYA_STATUTORY_SEED_2026) {
    const schema = STATUTORY_RULE_DEFINITION_SCHEMAS[row.ruleType];
    const parsed = schema.safeParse(row.ruleDefinition);
    if (!parsed.success) {
      throw new Error(
        `Statutory seed row for ${row.ruleType} failed shape validation: ${parsed.error.message}`,
      );
    }

    await prisma.statutoryRuleVersion.upsert({
      where: {
        jurisdictionId_ruleType_effectiveFrom: {
          jurisdictionId: jurisdiction.id,
          ruleType: row.ruleType,
          effectiveFrom: new Date(row.effectiveFrom),
        },
      },
      update: {
        taxYear: row.taxYear,
        ruleDefinition: parsed.data,
        sourceReference: row.sourceReference,
        isActive: true,
      },
      create: {
        jurisdictionId: jurisdiction.id,
        ruleType: row.ruleType,
        taxYear: row.taxYear,
        effectiveFrom: new Date(row.effectiveFrom),
        ruleDefinition: parsed.data,
        sourceReference: row.sourceReference,
        isActive: true,
      },
    });
  }
}

// -----------------------------------------------------------------------------
// Kenya Employment Act 2007 compliance rules.
//
// IMPORTANT — provenance: researched 2026-08-18 via a plain-text extraction
// of Act No. 11 of 2007 (mwakili.com/resources/legal-docs-plain-text/
// EmploymentAct11of2007) cross-checked against independent legal-summary
// sources (Studocu, FM Law Advocates, Manwa Advocates, a LinkedIn legal
// analysis by Mikhala Barasa). NOT verified against the primary Kenya Law
// Reports text (new.kenyalaw.org/akn/ke/act/2007/11) directly during this
// pass — recommend confirming there before these rules drive an automatic
// contract rejection (a FAIL-severity compliance finding) in production.
// -----------------------------------------------------------------------------

interface ComplianceSeedRow {
  ruleType: ComplianceRuleType;
  effectiveFrom: string;
  ruleDefinition: unknown;
  legalReference: string;
  sourceReference: string;
}

const KENYA_EMPLOYMENT_ACT_COMPLIANCE_RULES: ComplianceSeedRow[] = [
  {
    ruleType: "WRITTEN_CONTRACT_REQUIRED",
    effectiveFrom: "2007-01-01",
    ruleDefinition: {
      minimumAggregateDays: 90,
      alsoRequiredForSpecifiedWork: true,
    },
    legalReference: "Employment Act 2007 (Kenya), Section 9",
    sourceReference:
      "mwakili.com plain-text extraction of Act No. 11 of 2007, cross-checked against a Studocu summary of the Act (research performed 2026-08-18). Requires a written contract of service for engagements of an aggregate equivalent of three months or more, or for specified work not reasonably completable within three months.",
  },
  {
    ruleType: "EMPLOYMENT_PARTICULARS_REQUIRED",
    effectiveFrom: "2007-01-01",
    ruleDefinition: {
      requiredFields: [
        "employeeName",
        "employeeAge",
        "employeeAddress",
        "employeeSex",
        "employerName",
        "jobDescription",
        "commencementDate",
        "formAndDuration",
        "placeOfWork",
        "hoursOfWork",
        "remuneration",
        "remunerationIntervals",
        "continuousEmploymentDate",
      ],
      mustBeProvidedWithinDaysOfCommencement: 60,
    },
    legalReference: "Employment Act 2007 (Kenya), Section 10",
    sourceReference:
      "mwakili.com plain-text extraction of Act No. 11 of 2007 (research performed 2026-08-18). Particulars may be given in instalments but must be given not later than two months after the beginning of employment.",
  },
  {
    ruleType: "PROBATION_MAXIMUM_DURATION",
    effectiveFrom: "2007-01-01",
    ruleDefinition: {
      initialMaximumMonths: 6,
      extensionMaximumMonths: 6,
      totalMaximumMonths: 12,
      extensionRequiresWrittenConsent: true,
    },
    legalReference: "Employment Act 2007 (Kenya), Section 42(2)",
    sourceReference:
      "Cross-checked via fmlawadvocates.co.ke, manwaadvocates.com, and a LinkedIn legal analysis (Mikhala Barasa) — all describe an initial 6-month maximum probation, extendable once for a further period not exceeding 6 months with the employee's written agreement, for a 12-month total maximum (research performed 2026-08-18). Not verified against the primary Kenya Law Reports text directly.",
  },
  {
    ruleType: "NOTICE_PERIOD_MINIMUM",
    effectiveFrom: "2007-01-01",
    ruleDefinition: {
      dailyContractsNoticeDays: 0,
      subMonthlyContractsNoticePeriods: 1,
      monthlyOrLongerContractsNoticeDays: 28,
    },
    legalReference: "Employment Act 2007 (Kenya), Section 35",
    sourceReference:
      "mwakili.com plain-text extraction of Act No. 11 of 2007 (research performed 2026-08-18). Daily contracts: terminable at the close of any day without notice. Sub-monthly contracts: notice equal to one contract period. Monthly-or-longer contracts: 28 days notice (or payment in lieu).",
  },
  {
    ruleType: "CASUAL_CONVERSION_THRESHOLD",
    effectiveFrom: "2007-01-01",
    ruleDefinition: {
      continuousServiceThresholdDays: 30,
      convertsToDescription: "Monthly-wage contract; Section 35(1)(c) 28-day notice applies thereafter",
    },
    legalReference: "Employment Act 2007 (Kenya), Section 37",
    sourceReference:
      "mwakili.com plain-text extraction of Act No. 11 of 2007 (research performed 2026-08-18). A casual employee who works an aggregate of not less than one continuous month converts to monthly-wage status.",
  },
];

async function seedComplianceRules(): Promise<void> {
  console.log("Seeding Kenya jurisdiction (for compliance rules)...");
  const jurisdiction = await prisma.statutoryJurisdiction.upsert({
    where: { countryCode: "KE" },
    update: {},
    create: { countryCode: "KE", name: "Kenya" },
  });

  console.log("Seeding Kenya Employment Act 2007 compliance rules...");
  for (const row of KENYA_EMPLOYMENT_ACT_COMPLIANCE_RULES) {
    const schema = COMPLIANCE_RULE_DEFINITION_SCHEMAS[row.ruleType];
    const parsed = schema.safeParse(row.ruleDefinition);
    if (!parsed.success) {
      throw new Error(
        `Compliance rule seed row for ${row.ruleType} failed shape validation: ${parsed.error.message}`,
      );
    }

    await prisma.complianceRuleVersion.upsert({
      where: {
        jurisdictionId_ruleType_effectiveFrom: {
          jurisdictionId: jurisdiction.id,
          ruleType: row.ruleType,
          effectiveFrom: new Date(row.effectiveFrom),
        },
      },
      update: {
        ruleDefinition: parsed.data,
        legalReference: row.legalReference,
        sourceReference: row.sourceReference,
        isActive: true,
      },
      create: {
        jurisdictionId: jurisdiction.id,
        ruleType: row.ruleType,
        effectiveFrom: new Date(row.effectiveFrom),
        ruleDefinition: parsed.data,
        legalReference: row.legalReference,
        sourceReference: row.sourceReference,
        isActive: true,
      },
    });
  }
}

async function seedNexaRootOrganization(): Promise<void> {
  console.log("Seeding Nexa Workforce Solutions Ltd root organization...");
  await prisma.organization.upsert({
    where: { id: NEXA_ROOT_ORGANIZATION_ID },
    update: {},
    create: {
      id: NEXA_ROOT_ORGANIZATION_ID,
      type: "NEXA_HOLDING",
      legalName: "Nexa Workforce Solutions Ltd",
      displayName: "Nexa Workforce Solutions",
      countryCode: "KE",
    },
  });
}

// Creates the initial platform super-admin account, ONLY when
// AUTH_BOOTSTRAP_ENABLED=true and credentials are supplied via environment
// variables — never hard-coded, never a default password. Idempotent: if an
// account with that email already exists, its password is left untouched
// (it may have already been changed) — only the super-admin flag and active
// status are ensured. The password is never logged or returned.
async function seedBootstrapSuperAdmin(): Promise<void> {
  const bootstrapConfig = loadBootstrapAdminConfig();
  if (!bootstrapConfig.AUTH_BOOTSTRAP_ENABLED) {
    console.log("AUTH_BOOTSTRAP_ENABLED is not true — skipping super-admin bootstrap.");
    return;
  }

  // loadBootstrapAdminConfig() already guarantees these are present when
  // AUTH_BOOTSTRAP_ENABLED is true (see packages/config/src/env.ts).
  const email = bootstrapConfig.NEXA_BOOTSTRAP_ADMIN_EMAIL as string;
  const password = bootstrapConfig.NEXA_BOOTSTRAP_ADMIN_PASSWORD as string;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (!existing.isPlatformSuperAdmin || !existing.isActive) {
      await prisma.user.update({
        where: { id: existing.id },
        data: { isPlatformSuperAdmin: true, isActive: true },
      });
      console.log(`Bootstrap admin account already existed for ${email} — ensured super-admin/active flags.`);
    } else {
      console.log(`Bootstrap admin account already exists for ${email} — no changes made.`);
    }
    return;
  }

  assertPasswordPolicy(password);
  const passwordHash = await hashPassword(password);

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName: "Nexa",
      lastName: "Administrator",
      isPlatformSuperAdmin: true,
      isActive: true,
    },
  });

  console.log(`Bootstrap super-admin account created for ${email}.`);
}

async function main(): Promise<void> {
  assertSafeToRun();
  await seedPermissionsAndRoles();
  await seedEngagementTypes();
  await seedKenyaStatutoryData();
  await seedComplianceRules();
  await seedNexaRootOrganization();
  await seedBootstrapSuperAdmin();
  console.log("Seed complete.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
