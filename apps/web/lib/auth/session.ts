import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "next/navigation";
import { apiMe } from "../api/auth";
import { UnauthenticatedError } from "../api/errors";
import type { MeResponse } from "../../types/api";
import { ACCESS_TOKEN_COOKIE } from "./cookies";

/**
 * Reads the current session by calling the backend's /auth/me — the
 * backend (TenantContextGuard) is the authority on whether a session is
 * still valid, live membership, and current permissions; this never trusts
 * the JWT's own claims for anything beyond "is a cookie present at all."
 * `cache()` de-dupes repeat calls within a single request/render pass.
 */
export const getSession = cache(async (): Promise<MeResponse | null> => {
  const hasCookie = cookies().get(ACCESS_TOKEN_COOKIE)?.value;
  if (!hasCookie) {
    return null;
  }
  try {
    return await apiMe();
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      return null;
    }
    throw error;
  }
});

/** For Server Components that require a session — redirects to /login otherwise. */
export async function requireSession(): Promise<MeResponse> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  return session;
}
