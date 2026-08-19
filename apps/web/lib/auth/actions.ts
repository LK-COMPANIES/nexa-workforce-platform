"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema, registerClientOrganizationSchema } from "@nexa/validation";
import { apiLogin, apiLogout, apiRegister, apiSwitchOrganization } from "../api/auth";
import { ApiError } from "../api/errors";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  cookieOptions,
} from "./cookies";

export interface FormActionState {
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

function persistTokens(accessToken: string, refreshToken: string): void {
  const cookieStore = cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, cookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS));
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS));
}

function clearTokens(): void {
  const cookieStore = cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

// Deliberately generic on failure — mirrors the backend's own anti-
// enumeration posture (brief §15 in the Phase 2 brief). Never surfaces
// "wrong password" vs "unknown org" vs "unknown email" distinctly.
export async function loginAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    organizationId: formData.get("organizationId"),
  });
  if (!parsed.success) {
    return { error: "Please check the form for errors.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    const result = await apiLogin(parsed.data);
    persistTokens(result.accessToken, result.refreshToken);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: "Invalid email, password, or organization." };
    }
    throw error;
  }

  redirect("/dashboard");
}

export async function registerAction(_prevState: FormActionState, formData: FormData): Promise<FormActionState> {
  const parsed = registerClientOrganizationSchema.safeParse({
    organization: {
      legalName: formData.get("legalName"),
      displayName: formData.get("displayName"),
      countryCode: formData.get("countryCode") || "KE",
      taxIdentifier: formData.get("taxIdentifier") || undefined,
    },
    admin: {
      email: formData.get("email"),
      password: formData.get("password"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      phone: formData.get("phone") || undefined,
    },
  });
  if (!parsed.success) {
    return { error: "Please check the form for errors.", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await apiRegister(parsed.data);
  } catch {
    return { error: "Registration failed. The email may already be in use." };
  }

  redirect("/login?registered=1");
}

export async function logoutAction(): Promise<void> {
  try {
    await apiLogout();
  } catch {
    // Even if the backend call fails (e.g. session already expired), still
    // clear local cookies — the user's intent is to be logged out either way.
  }
  clearTokens();
  redirect("/login");
}

// Called directly (not via a <form>) from OrgSwitcher's dropdown — see that
// component for why: nesting multiple submit buttons inside Radix dropdown
// items is fragile, whereas a Server Action is just an async function
// Client Components can call directly. `organizationId` always comes from
// the membership list rendered client-side (itself sourced from GET
// /auth/memberships), never free-typed input (brief §12).
export async function switchOrganizationDirect(
  organizationId: string,
): Promise<{ error: string } | undefined> {
  try {
    const result = await apiSwitchOrganization(organizationId);
    persistTokens(result.accessToken, result.refreshToken);
  } catch (error) {
    if (error instanceof ApiError) {
      return { error: "You are not authorized to switch to that organization." };
    }
    throw error;
  }

  // Every organization-scoped Server Component re-renders against the new
  // tenant context on the next navigation — brief §12: "prevent data from
  // the previous tenant remaining visible after switching." Redirecting to
  // /dashboard (rather than revalidating in place) guarantees a full,
  // fresh render tree under the new cookies, not a partially-stale one.
  redirect("/dashboard");
}
