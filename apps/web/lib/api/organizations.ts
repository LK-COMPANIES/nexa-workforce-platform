import "server-only";
import type { OrganizationMemberSummary, OrganizationSummary } from "../../types/api";
import { apiFetch } from "./server-fetch";

export async function apiGetCurrentOrganization(): Promise<OrganizationSummary> {
  return apiFetch<OrganizationSummary>("/organizations/me");
}

export async function apiListOrganizationMembers(): Promise<OrganizationMemberSummary[]> {
  return apiFetch<OrganizationMemberSummary[]>("/organizations/members");
}
