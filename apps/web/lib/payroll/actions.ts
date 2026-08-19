"use server";

import { revalidatePath } from "next/cache";
import { createPayrollRunSchema, payrollCalculatorSchema, type CreatePayrollRunInput, type PayrollCalculatorInput } from "@nexa/validation";
import type { PayrollCalculationResult } from "@nexa/payroll-engine";
import {
  apiApprovePayrollRun,
  apiCalculatePayrollPreview,
  apiCalculatePayrollRun,
  apiCreatePayrollRun,
  apiFinalizePayrollRun,
  apiVoidPayrollRun,
} from "../api/payroll";
import { ApiError } from "../api/errors";

export interface PayrollActionState {
  error?: string;
}

const initialState: PayrollActionState = {};
export { initialState as initialPayrollActionState };

export async function createPayrollRunAction(
  _prevState: PayrollActionState,
  formData: FormData,
): Promise<PayrollActionState> {
  const parsed = createPayrollRunSchema.safeParse({
    payrollPeriodStart: formData.get("payrollPeriodStart"),
    payrollPeriodEnd: formData.get("payrollPeriodEnd"),
    runType: formData.get("runType") || "REGULAR",
    currency: formData.get("currency") || "KES",
  } satisfies Partial<Record<keyof CreatePayrollRunInput, unknown>>);

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  try {
    await apiCreatePayrollRun(parsed.data);
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      return { error: "A payroll run already exists for this organization, period, and type." };
    }
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }

  revalidatePath("/payroll");
  return {};
}

// Every lifecycle action below re-fetches the fresh run afterward via
// revalidatePath — the UI never optimistically assumes success (brief §15:
// "the UI must not bypass backend state validation").
export async function calculatePayrollRunAction(runId: string): Promise<PayrollActionState> {
  try {
    await apiCalculatePayrollRun(runId);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/payroll/${runId}`);
  return {};
}

export async function approvePayrollRunAction(runId: string): Promise<PayrollActionState> {
  try {
    await apiApprovePayrollRun(runId);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/payroll/${runId}`);
  return {};
}

export async function finalizePayrollRunAction(runId: string): Promise<PayrollActionState> {
  try {
    await apiFinalizePayrollRun(runId);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/payroll/${runId}`);
  return {};
}

// Ad-hoc gross-to-net calculator (brief §14). Takes a plain object directly
// (Server Actions can accept any serializable argument, not only FormData)
// — validated again here with the SAME zod schema the backend uses, so a
// malformed client-side state is caught before the network round-trip, but
// the backend's own validation remains authoritative regardless.
export async function calculatePayrollPreviewAction(
  input: PayrollCalculatorInput,
): Promise<{ result?: PayrollCalculationResult; error?: string }> {
  const parsed = payrollCalculatorSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  try {
    const result = await apiCalculatePayrollPreview(parsed.data);
    return { result };
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: error.message };
    }
    throw error;
  }
}

export async function voidPayrollRunAction(runId: string, reason: string): Promise<PayrollActionState> {
  if (!reason.trim()) {
    return { error: "A reason is required to void a payroll run." };
  }
  try {
    await apiVoidPayrollRun(runId, reason);
  } catch (error) {
    if (error instanceof ApiError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/payroll/${runId}`);
  return {};
}
