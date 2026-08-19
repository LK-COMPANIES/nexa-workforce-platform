import "server-only";
import type { CreatePayrollRunInput, PayrollCalculatorInput } from "@nexa/validation";
import type { PayrollCalculationResult } from "@nexa/payroll-engine";
import type { PayrollRecordRow, PayrollRunSummaryReport, PayrollRunSummaryRow } from "../../types/api";
import { apiFetch } from "./server-fetch";

export async function apiListPayrollRuns(): Promise<PayrollRunSummaryRow[]> {
  return apiFetch<PayrollRunSummaryRow[]>("/payroll/runs");
}

export async function apiGetPayrollRun(runId: string): Promise<PayrollRunSummaryRow> {
  return apiFetch<PayrollRunSummaryRow>(`/payroll/runs/${runId}`);
}

export async function apiGetPayrollRunRecords(runId: string): Promise<PayrollRecordRow[]> {
  return apiFetch<PayrollRecordRow[]>(`/payroll/runs/${runId}/records`);
}

export async function apiGetPayrollRunSummary(runId: string): Promise<PayrollRunSummaryReport> {
  return apiFetch<PayrollRunSummaryReport>(`/payroll/runs/${runId}/summary`);
}

export async function apiCreatePayrollRun(input: CreatePayrollRunInput): Promise<PayrollRunSummaryRow> {
  return apiFetch<PayrollRunSummaryRow>("/payroll/runs", { method: "POST", body: input });
}

export async function apiCalculatePayrollRun(runId: string): Promise<PayrollRunSummaryRow> {
  return apiFetch<PayrollRunSummaryRow>(`/payroll/runs/${runId}/calculate`, { method: "POST" });
}

export async function apiApprovePayrollRun(runId: string): Promise<PayrollRunSummaryRow> {
  return apiFetch<PayrollRunSummaryRow>(`/payroll/runs/${runId}/approve`, { method: "POST" });
}

export async function apiFinalizePayrollRun(runId: string): Promise<PayrollRunSummaryRow> {
  return apiFetch<PayrollRunSummaryRow>(`/payroll/runs/${runId}/finalize`, { method: "POST" });
}

export async function apiVoidPayrollRun(runId: string, reason: string): Promise<PayrollRunSummaryRow> {
  return apiFetch<PayrollRunSummaryRow>(`/payroll/runs/${runId}/void`, { method: "POST", body: { reason } });
}

// Ad-hoc gross-to-net "what-if" calculator (brief §14) — calls the SAME
// backend engine as a real payroll run; never recomputes PAYE/NSSF/SHIF/
// Housing Levy in the browser.
export async function apiCalculatePayrollPreview(
  input: PayrollCalculatorInput,
): Promise<PayrollCalculationResult> {
  return apiFetch<PayrollCalculationResult>("/payroll/calculator", { method: "POST", body: input });
}
