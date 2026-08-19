import "server-only";
import type { CreateContractInput, UpdateContractInput } from "@nexa/validation";
import type { ComplianceEvaluationRow, ComplianceSummary, ContractRow } from "../../types/api";
import { apiFetch } from "./server-fetch";

export async function apiListContracts(): Promise<ContractRow[]> {
  return apiFetch<ContractRow[]>("/contracts");
}

export async function apiGetContract(contractId: string): Promise<ContractRow> {
  return apiFetch<ContractRow>(`/contracts/${contractId}`);
}

export async function apiCreateContract(input: CreateContractInput): Promise<ContractRow> {
  return apiFetch<ContractRow>("/contracts", { method: "POST", body: input });
}

export async function apiUpdateContract(contractId: string, input: UpdateContractInput): Promise<ContractRow> {
  return apiFetch<ContractRow>(`/contracts/${contractId}`, { method: "PATCH", body: input });
}

export async function apiEvaluateContractCompliance(contractId: string): Promise<ComplianceEvaluationRow> {
  return apiFetch<ComplianceEvaluationRow>(`/contracts/${contractId}/compliance/evaluate`, { method: "POST" });
}

export async function apiListContractCompliance(contractId: string): Promise<ComplianceEvaluationRow[]> {
  return apiFetch<ComplianceEvaluationRow[]>(`/contracts/${contractId}/compliance`);
}

export async function apiGetComplianceSummary(): Promise<ComplianceSummary> {
  return apiFetch<ComplianceSummary>("/contracts/compliance/summary");
}
