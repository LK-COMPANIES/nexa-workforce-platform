-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('NEXA_HOLDING', 'SUBSIDIARY', 'CLIENT', 'CLIENT_BUSINESS_UNIT', 'OPERATIONAL_ENTITY');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RefreshTokenStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'REUSE_DETECTED');

-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILURE', 'LOGOUT', 'REFRESH', 'REFRESH_REUSE_DETECTED', 'SESSION_REVOKED', 'PASSWORD_CHANGED', 'REGISTRATION', 'ACCOUNT_DISABLED', 'UNAUTHORIZED_ACCESS_ATTEMPT', 'TENANT_ACCESS_DENIED', 'SUPER_ADMIN_ORG_ACCESS');

-- CreateEnum
CREATE TYPE "EmploymentIdentityStatus" AS ENUM ('ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('PERMANENT_EMPLOYMENT', 'FIXED_TERM_EMPLOYMENT', 'TEMPORARY_STAFFING', 'OUTSOURCED_WORKFORCE', 'CONSULTING_ENGAGEMENT', 'CLIENT_SERVICES_AGREEMENT', 'INTERNSHIP');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'TERMINATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "StatutoryRuleType" AS ENUM ('PAYE', 'NSSF', 'SHIF', 'HOUSING_LEVY');

-- CreateEnum
CREATE TYPE "PayrollRecordStatus" AS ENUM ('DRAFT', 'CALCULATED', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AIRequestStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILURE', 'REJECTED');

-- CreateEnum
CREATE TYPE "AIReviewDecision" AS ENUM ('APPROVED', 'REJECTED', 'NOT_REQUIRED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "tax_identifier" TEXT,
    "country_code" CHAR(2) NOT NULL DEFAULT 'KE',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB,
    "parent_organization_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_platform_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system_role" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id","permission_id")
);

-- CreateTable
CREATE TABLE "organization_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'INVITED',
    "invited_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_super_admin_session" BOOLEAN NOT NULL DEFAULT false,
    "ip_address" INET,
    "user_agent" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "status" "RefreshTokenStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "rotated_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authentication_audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "acting_user_id" UUID,
    "session_id" UUID,
    "event_type" "AuthEventType" NOT NULL,
    "ip_address" INET,
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authentication_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_number" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "work_email" TEXT,
    "phone" TEXT,
    "national_id_number" TEXT,
    "date_of_birth" DATE,
    "hire_date" DATE NOT NULL,
    "status" "EmploymentIdentityStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contracts" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID,
    "contract_type" "ContractType" NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "reference_code" TEXT,
    "effective_date" DATE NOT NULL,
    "expiration_date" DATE,
    "base_compensation" DECIMAL(14,2),
    "currency" CHAR(3),
    "document_storage_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_jurisdictions" (
    "id" UUID NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statutory_jurisdictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "statutory_rule_versions" (
    "id" UUID NOT NULL,
    "jurisdiction_id" UUID NOT NULL,
    "rule_type" "StatutoryRuleType" NOT NULL,
    "tax_year" INTEGER NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "rule_definition" JSONB NOT NULL,
    "source_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "statutory_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_types" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engagement_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "contract_id" UUID,
    "statutory_rule_version_id" UUID NOT NULL,
    "payroll_period_start" DATE NOT NULL,
    "payroll_period_end" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "gross_pay" DECIMAL(14,2) NOT NULL,
    "taxable_income" DECIMAL(14,2) NOT NULL,
    "paye_amount" DECIMAL(14,2) NOT NULL,
    "nssf_employee_amount" DECIMAL(14,2) NOT NULL,
    "nssf_employer_amount" DECIMAL(14,2) NOT NULL,
    "shif_amount" DECIMAL(14,2) NOT NULL,
    "housing_levy_employee_amount" DECIMAL(14,2) NOT NULL,
    "housing_levy_employer_amount" DECIMAL(14,2) NOT NULL,
    "other_deductions" JSONB,
    "net_pay" DECIMAL(14,2) NOT NULL,
    "status" "PayrollRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "calculated_at" TIMESTAMP(3),
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_audit_logs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requesting_user_id" UUID,
    "agent_service" TEXT NOT NULL,
    "model_identifier" TEXT NOT NULL,
    "request_type" TEXT NOT NULL,
    "input_ref" TEXT,
    "output_ref" TEXT,
    "status" "AIRequestStatus" NOT NULL DEFAULT 'PENDING',
    "error_summary" TEXT,
    "prompt_tokens" INTEGER,
    "completion_tokens" INTEGER,
    "latency_ms" INTEGER,
    "tools_used" JSONB,
    "requires_human_review" BOOLEAN NOT NULL DEFAULT false,
    "review_decision" "AIReviewDecision",
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "organizations_parent_organization_id_idx" ON "organizations"("parent_organization_id");

-- CreateIndex
CREATE INDEX "organizations_type_idx" ON "organizations"("type");

-- CreateIndex
CREATE INDEX "organizations_country_code_idx" ON "organizations"("country_code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_idx" ON "organization_memberships"("organization_id");

-- CreateIndex
CREATE INDEX "organization_memberships_user_id_idx" ON "organization_memberships"("user_id");

-- CreateIndex
CREATE INDEX "organization_memberships_organization_id_status_idx" ON "organization_memberships"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "organization_memberships_user_id_organization_id_key" ON "organization_memberships"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_organization_id_idx" ON "sessions"("organization_id");

-- CreateIndex
CREATE INDEX "sessions_organization_id_status_idx" ON "sessions"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens"("session_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_family_id_idx" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_status_idx" ON "refresh_tokens"("status");

-- CreateIndex
CREATE INDEX "authentication_audit_events_organization_id_idx" ON "authentication_audit_events"("organization_id");

-- CreateIndex
CREATE INDEX "authentication_audit_events_organization_id_created_at_idx" ON "authentication_audit_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "authentication_audit_events_acting_user_id_idx" ON "authentication_audit_events"("acting_user_id");

-- CreateIndex
CREATE INDEX "authentication_audit_events_event_type_idx" ON "authentication_audit_events"("event_type");

-- CreateIndex
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_idx" ON "employees"("organization_id");

-- CreateIndex
CREATE INDEX "employees_organization_id_status_idx" ON "employees"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organization_id_employee_number_key" ON "employees"("organization_id", "employee_number");

-- CreateIndex
CREATE INDEX "contracts_organization_id_idx" ON "contracts"("organization_id");

-- CreateIndex
CREATE INDEX "contracts_employee_id_idx" ON "contracts"("employee_id");

-- CreateIndex
CREATE INDEX "contracts_organization_id_status_idx" ON "contracts"("organization_id", "status");

-- CreateIndex
CREATE INDEX "contracts_organization_id_expiration_date_idx" ON "contracts"("organization_id", "expiration_date");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_jurisdictions_country_code_key" ON "statutory_jurisdictions"("country_code");

-- CreateIndex
CREATE INDEX "statutory_rule_versions_jurisdiction_id_rule_type_is_active_idx" ON "statutory_rule_versions"("jurisdiction_id", "rule_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "statutory_rule_versions_jurisdiction_id_rule_type_effective_key" ON "statutory_rule_versions"("jurisdiction_id", "rule_type", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "engagement_types_key_key" ON "engagement_types"("key");

-- CreateIndex
CREATE INDEX "payroll_records_organization_id_idx" ON "payroll_records"("organization_id");

-- CreateIndex
CREATE INDEX "payroll_records_employee_id_idx" ON "payroll_records"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_records_organization_id_payroll_period_start_idx" ON "payroll_records"("organization_id", "payroll_period_start");

-- CreateIndex
CREATE INDEX "payroll_records_organization_id_status_idx" ON "payroll_records"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ai_audit_logs_organization_id_idx" ON "ai_audit_logs"("organization_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_organization_id_created_at_idx" ON "ai_audit_logs"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "ai_audit_logs_requesting_user_id_idx" ON "ai_audit_logs"("requesting_user_id");

-- CreateIndex
CREATE INDEX "ai_audit_logs_status_idx" ON "ai_audit_logs"("status");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_parent_organization_id_fkey" FOREIGN KEY ("parent_organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_memberships" ADD CONSTRAINT "organization_memberships_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_audit_events" ADD CONSTRAINT "authentication_audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_audit_events" ADD CONSTRAINT "authentication_audit_events_acting_user_id_fkey" FOREIGN KEY ("acting_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authentication_audit_events" ADD CONSTRAINT "authentication_audit_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "statutory_rule_versions" ADD CONSTRAINT "statutory_rule_versions_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "statutory_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_statutory_rule_version_id_fkey" FOREIGN KEY ("statutory_rule_version_id") REFERENCES "statutory_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_requesting_user_id_fkey" FOREIGN KEY ("requesting_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_audit_logs" ADD CONSTRAINT "ai_audit_logs_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

