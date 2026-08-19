import "server-only";
import { cookies } from "next/headers";
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
  cookieOptions,
} from "../auth/cookies";
import { toApiError, UnauthenticatedError } from "./errors";

// Server-only API origin. In docker-compose this resolves to the internal
// service name; on the host it's the same as NEXT_PUBLIC_API_URL. Never
// read on the client — this file has the `server-only` guard above, which
// makes accidentally importing it from a Client Component a build error.
function apiOrigin(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip attaching the Authorization header — only for /auth/login, /auth/register, /auth/refresh. */
  unauthenticated?: boolean;
}

async function rawFetch(path: string, accessToken: string | undefined, init: ApiFetchOptions): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (accessToken && !init.unauthenticated) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(`${apiOrigin()}${path}`, {
    ...init,
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
}

// Attempts one silent refresh using the httpOnly refresh-token cookie, and
// persists the new token pair. Only callable where Next.js permits cookie
// mutation (Server Actions, Route Handlers) — see the try/catch below for
// why a Server Component falling through here is still handled gracefully.
async function attemptRefresh(): Promise<string | null> {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  const response = await rawFetch("/auth/refresh", undefined, {
    method: "POST",
    body: { refreshToken },
    unauthenticated: true,
  });
  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { accessToken: string; refreshToken: string };
  try {
    cookieStore.set(ACCESS_TOKEN_COOKIE, data.accessToken, cookieOptions(ACCESS_TOKEN_MAX_AGE_SECONDS));
    cookieStore.set(REFRESH_TOKEN_COOKIE, data.refreshToken, cookieOptions(REFRESH_TOKEN_MAX_AGE_SECONDS));
  } catch {
    // Called from a Server Component (read-only cookie context) — the new
    // access token is still usable for THIS request, it just won't persist
    // for the next one. Middleware is the primary mechanism that keeps
    // cookies fresh before a Server Component ever renders; this is a
    // best-effort fallback, not the main path.
  }
  return data.accessToken;
}

/**
 * The single entry point for every authenticated NestJS call from server
 * code (brief §21: no scattered raw `fetch()` calls). Attaches the access
 * token, retries exactly once through a silent refresh on 401, and throws a
 * typed ApiError (see errors.ts) for every other non-2xx status.
 */
export async function apiFetch<T>(path: string, init: ApiFetchOptions = {}): Promise<T> {
  const cookieStore = cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken && !init.unauthenticated) {
    throw new UnauthenticatedError();
  }

  let response = await rawFetch(path, accessToken, init);

  if (response.status === 401 && !init.unauthenticated) {
    const refreshedToken = await attemptRefresh();
    if (!refreshedToken) {
      throw new UnauthenticatedError();
    }
    response = await rawFetch(path, refreshedToken, init);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json") ? await response.json() : await response.text();

  if (!response.ok) {
    throw toApiError(response.status, payload);
  }

  return payload as T;
}
