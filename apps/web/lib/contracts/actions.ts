"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createContractSchema, updateContractSchema, type CreateContractInput, type UpdateContractInput } from "@nexa/validation";
import { apiGetAiJobStatus, apiRequestContractAudit } from "../api/ai";
import { apiCreateContract, apiEvaluateContractCompliance, apiUpdateContract } from "../api/contracts";
import { ApiError } from "../api/errors";
import type { AiJobStatusResponse } from "../../types/api";

export interface ContractActionState {
  error?: string;
}

export async function createContractAction(input: CreateContractInput): Promise<ContractActionState> {
  const parsed = createContractSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  let contractId: string;
  try {
    const contract = await apiCreateContract(parsed.data);
    contractId = contract.id;
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/contracts");
  redirect(`/contracts/${contractId}`);
}

export async function evaluateComplianceAction(contractId: string): Promise<ContractActionState> {
  try {
    await apiEvaluateContractCompliance(contractId);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/contracts/${contractId}`);
  return {};
}

export interface AiAuditActionState {
  jobId?: string;
  error?: string;
}

// Kicks off an apps/ai contract-audit job (async — see apps/ai/app/agents/
// contract_audit). Returns immediately with a job_id for the client to
// poll via getAiJobStatusAction; never blocks on the Claude call itself.
export async function requestAiContractAuditAction(contractId: string): Promise<AiAuditActionState> {
  try {
    const job = await apiRequestContractAudit(contractId);
    return { jobId: job.jobId };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function getAiJobStatusAction(
  jobId: string,
): Promise<{ job?: AiJobStatusResponse; error?: string }> {
  try {
    const job = await apiGetAiJobStatus(jobId);
    return { job };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}

// Remediation step of the brief §19 workflow (Generate -> Validate ->
// Display Findings -> User Remediation -> Revalidate): applies a targeted
// update to the fields most likely flagged by the compliance engine, so a
// user can fix a violation and re-run evaluateComplianceAction without
// leaving the page.
export async function updateContractAction(
  contractId: string,
  input: UpdateContractInput,
): Promise<ContractActionState> {
  const parsed = updateContractSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form for errors." };
  }

  try {
    await apiUpdateContract(contractId, parsed.data);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
  revalidatePath(`/contracts/${contractId}`);
  return {};
}
