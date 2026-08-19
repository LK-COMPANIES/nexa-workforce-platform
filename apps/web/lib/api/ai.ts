import "server-only";
import type { AiJobAccepted, AiJobStatusResponse } from "../../types/api";
import { apiFetch } from "./server-fetch";

export async function apiRequestContractAudit(contractId: string): Promise<AiJobAccepted> {
  return apiFetch<AiJobAccepted>(`/contracts/${contractId}/ai-audit`, { method: "POST" });
}

export async function apiGetAiJobStatus(jobId: string): Promise<AiJobStatusResponse> {
  return apiFetch<AiJobStatusResponse>(`/ai/jobs/${jobId}`);
}
