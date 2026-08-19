import "server-only";
import type { LoginInput, RegisterClientOrganizationInput } from "@nexa/validation";
import type { AuthSuccessResponse, MeResponse, MembershipSummary } from "../../types/api";
import { apiFetch } from "./server-fetch";

export async function apiLogin(input: LoginInput): Promise<AuthSuccessResponse> {
  return apiFetch<AuthSuccessResponse>("/auth/login", { method: "POST", body: input, unauthenticated: true });
}

export async function apiRegister(
  input: RegisterClientOrganizationInput,
): Promise<{ organization: { id: string; displayName: string }; user: { id: string; email: string } }> {
  return apiFetch("/auth/register", { method: "POST", body: input, unauthenticated: true });
}

export async function apiRefresh(refreshToken: string): Promise<AuthSuccessResponse> {
  return apiFetch<AuthSuccessResponse>("/auth/refresh", {
    method: "POST",
    body: { refreshToken },
    unauthenticated: true,
  });
}

export async function apiLogout(): Promise<void> {
  await apiFetch<void>("/auth/logout", { method: "POST" });
}

export async function apiMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/auth/me");
}

export async function apiListMemberships(): Promise<MembershipSummary[]> {
  return apiFetch<MembershipSummary[]>("/auth/memberships");
}

export async function apiSwitchOrganization(organizationId: string): Promise<AuthSuccessResponse> {
  return apiFetch<AuthSuccessResponse>("/auth/switch-organization", {
    method: "POST",
    body: { organizationId },
  });
}
