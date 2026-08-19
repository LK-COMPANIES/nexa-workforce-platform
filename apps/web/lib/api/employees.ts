import "server-only";
import type { EmployeeRow } from "../../types/api";
import { apiFetch } from "./server-fetch";

export async function apiListEmployees(): Promise<EmployeeRow[]> {
  return apiFetch<EmployeeRow[]>("/employees");
}
