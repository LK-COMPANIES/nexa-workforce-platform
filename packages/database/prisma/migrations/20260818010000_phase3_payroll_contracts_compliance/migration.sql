-- Phase 3: payroll run/lifecycle, corrected PayrollRecord (see schema.prisma
-- comments for why the Phase 1 single statutoryRuleVersionId FK was wrong),
-- contract compliance fields, and the compliance rule/evaluation tables.
--
-- NOTE: this migration adds "payroll_records"."payroll_run_id" as NOT NULL
-- with no default (line ~60 below), which requires the table to be empty at
-- migration time. That is true for every real environment: Phase 1/2 never
-- shipped any payroll-writing code path, so no payroll_records rows can
-- exist before this migration runs. If that assumption is ever false,
-- backfill payroll_run_id before applying this migration.

-- CreateEnum
CREATE TYPE "PaymentInterval" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "ComplianceRuleType" AS ENUM ('PROBATION_MAXIMUM_DURATION', 'WRITTEN_CONTRACT_REQUIRED', 'NOTICE_PERIOD_MINIMUM', 'CASUAL_CONVERSION_THRESHOLD', 'EMPLOYMENT_PARTICULARS_REQUIRED');

-- CreateEnum
CREATE TYPE "ComplianceSubjectType" AS ENUM ('CONTRACT', 'PAYROLL_RUN', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('PASS', 'WARNING', 'FAIL', 'REQUIRES_HUMAN_REVIEW');

-- CreateEnum
CREATE TYPE "PayrollRunType" AS ENUM ('REGULAR', 'OFF_CYCLE', 'CORRECTION');

-- CreateEnum
CREATE TYPE "PayrollRunStatus" AS ENUM ('DRAFT', 'CALCULATING', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'VOIDED', 'FAILED');

-- AlterEnum
ALTER TYPE "ContractType" ADD VALUE 'CASUAL';

-- DropForeignKey
ALTER TABLE "payroll_records" DROP CONSTRAINT "payroll_records_statutory_rule_version_id_fkey";

-- DropForeignKey
ALTER TABLE "payroll_records" DROP CONSTRAINT "payroll_records_approved_by_user_id_fkey";

-- DropIndex
DROP INDEX "payroll_records_organization_id_status_idx";

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN     "continuous_employment_date" DATE,
ADD COLUMN     "job_description" TEXT,
ADD COLUMN     "job_title" TEXT,
ADD COLUMN     "notice_period_days" INTEGER,
ADD COLUMN     "payment_interval" "PaymentInterval",
ADD COLUMN     "probation_extended_months" INTEGER,
ADD COLUMN     "probation_extension_consent" BOOLEAN,
ADD COLUMN     "probation_months" INTEGER,
ADD COLUMN     "terms" JSONB,
ADD COLUMN     "work_location" TEXT,
ADD COLUMN     "working_hours_per_week" DECIMAL(5,2);

-- AlterTable
ALTER TABLE "payroll_records" DROP COLUMN "approved_at",
DROP COLUMN "approved_by_user_id",
DROP COLUMN "calculated_at",
DROP COLUMN "paid_at",
DROP COLUMN "status",
DROP COLUMN "statutory_rule_version_id",
ADD COLUMN     "allowable_deductions" JSONB,
ADD COLUMN     "calculation_steps" JSONB NOT NULL,
ADD COLUMN     "cash_pay" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "effective_tax_rate" DECIMAL(7,4) NOT NULL,
ADD COLUMN     "employer_statutory_cost" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "engine_version" TEXT NOT NULL,
ADD COLUMN     "non_cash_benefits" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "other_reliefs" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paye_before_relief" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "payroll_run_id" UUID NOT NULL,
ADD COLUMN     "personal_relief" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "taxable_benefits" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "total_employee_deductions" DECIMAL(14,2) NOT NULL,
ADD COLUMN     "total_employment_cost" DECIMAL(14,2) NOT NULL;

-- DropEnum
DROP TYPE "PayrollRecordStatus";

-- CreateTable
CREATE TABLE "compliance_rule_versions" (
    "id" UUID NOT NULL,
    "jurisdiction_id" UUID NOT NULL,
    "rule_type" "ComplianceRuleType" NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "rule_definition" JSONB NOT NULL,
    "legal_reference" TEXT NOT NULL,
    "source_reference" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "compliance_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_evaluations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "subject_type" "ComplianceSubjectType" NOT NULL,
    "contract_id" UUID,
    "payroll_run_id" UUID,
    "employee_id" UUID,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'REQUIRES_HUMAN_REVIEW',
    "score" DECIMAL(5,2),
    "findings" JSONB NOT NULL,
    "rule_engine_version" TEXT NOT NULL,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "run_type" "PayrollRunType" NOT NULL DEFAULT 'REGULAR',
    "status" "PayrollRunStatus" NOT NULL DEFAULT 'DRAFT',
    "payroll_period_start" DATE NOT NULL,
    "payroll_period_end" DATE NOT NULL,
    "currency" CHAR(3) NOT NULL,
    "employee_count" INTEGER NOT NULL DEFAULT 0,
    "gross_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "taxable_pay_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "paye_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "nssf_employee_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "nssf_employer_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "shif_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "housing_levy_employee_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "housing_levy_employer_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "other_deductions_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "net_payroll_total" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "total_employment_cost" DECIMAL(16,2) NOT NULL DEFAULT 0,
    "engine_version" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "approved_by_user_id" UUID,
    "approved_at" TIMESTAMP(3),
    "finalized_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "voided_reason" TEXT,
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_run_statutory_rules" (
    "payroll_run_id" UUID NOT NULL,
    "rule_type" "StatutoryRuleType" NOT NULL,
    "statutory_rule_version_id" UUID NOT NULL,

    CONSTRAINT "payroll_run_statutory_rules_pkey" PRIMARY KEY ("payroll_run_id","rule_type")
);

-- CreateIndex
CREATE INDEX "compliance_rule_versions_jurisdiction_id_rule_type_is_activ_idx" ON "compliance_rule_versions"("jurisdiction_id", "rule_type", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "compliance_rule_versions_jurisdiction_id_rule_type_effectiv_key" ON "compliance_rule_versions"("jurisdiction_id", "rule_type", "effective_from");

-- CreateIndex
CREATE INDEX "compliance_evaluations_organization_id_idx" ON "compliance_evaluations"("organization_id");

-- CreateIndex
CREATE INDEX "compliance_evaluations_organization_id_created_at_idx" ON "compliance_evaluations"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "compliance_evaluations_contract_id_idx" ON "compliance_evaluations"("contract_id");

-- CreateIndex
CREATE INDEX "compliance_evaluations_payroll_run_id_idx" ON "compliance_evaluations"("payroll_run_id");

-- CreateIndex
CREATE INDEX "compliance_evaluations_employee_id_idx" ON "compliance_evaluations"("employee_id");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_idx" ON "payroll_runs"("organization_id");

-- CreateIndex
CREATE INDEX "payroll_runs_organization_id_status_idx" ON "payroll_runs"("organization_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_organization_id_payroll_period_start_payroll_p_key" ON "payroll_runs"("organization_id", "payroll_period_start", "payroll_period_end", "run_type");

-- CreateIndex
CREATE INDEX "payroll_records_payroll_run_id_idx" ON "payroll_records"("payroll_run_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_records_payroll_run_id_employee_id_key" ON "payroll_records"("payroll_run_id", "employee_id");

-- AddForeignKey
ALTER TABLE "compliance_rule_versions" ADD CONSTRAINT "compliance_rule_versions_jurisdiction_id_fkey" FOREIGN KEY ("jurisdiction_id") REFERENCES "statutory_jurisdictions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_evaluations" ADD CONSTRAINT "compliance_evaluations_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_approved_by_user_id_fkey" FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_statutory_rules" ADD CONSTRAINT "payroll_run_statutory_rules_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_run_statutory_rules" ADD CONSTRAINT "payroll_run_statutory_rules_statutory_rule_version_id_fkey" FOREIGN KEY ("statutory_rule_version_id") REFERENCES "statutory_rule_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_records" ADD CONSTRAINT "payroll_records_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

