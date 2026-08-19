-- CreateEnum
CREATE TYPE "AiAgentType" AS ENUM ('CONTRACT_AUDIT', 'BPO_QA');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "agent_type" "AiAgentType" NOT NULL,
    "status" "AiJobStatus" NOT NULL DEFAULT 'PENDING',
    "prompt_version" TEXT NOT NULL,
    "subject_contract_id" UUID,
    "result_json" JSONB,
    "error_summary" TEXT,
    "audit_log_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_jobs_audit_log_id_key" ON "ai_jobs"("audit_log_id");

-- CreateIndex
CREATE INDEX "ai_jobs_organization_id_idx" ON "ai_jobs"("organization_id");

-- CreateIndex
CREATE INDEX "ai_jobs_organization_id_status_idx" ON "ai_jobs"("organization_id", "status");

-- CreateIndex
CREATE INDEX "ai_jobs_subject_contract_id_idx" ON "ai_jobs"("subject_contract_id");

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_subject_contract_id_fkey" FOREIGN KEY ("subject_contract_id") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_audit_log_id_fkey" FOREIGN KEY ("audit_log_id") REFERENCES "ai_audit_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

