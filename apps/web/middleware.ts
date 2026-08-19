import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE, ACCESS_TOKEN_MAX_AGE_SECONDS, REFRESH_TOKEN_COOKIE, REFRESH_TOKEN_MAX_AGE_SECONDS } from "./lib/auth/cookies";
import { isTokenExpiringSoon } from "./lib/auth/jwt-decode";

const PUBLIC_PATHS = ["/login", "/register"];

function apiOrigin(): string {
  return process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

// Runs BEFORE every matched request. Two jobs:
//   1. Proactive silent refresh — Next.js Server Components cannot mutate
//      cookies mid-render (see lib/api/server-fetch.ts's comment on this),
//      so middleware is where token refresh actually happens in the common
//      case: by the time a page renders, cookies are already fresh.
//   2. Route protection — redirect unauthenticated visitors away from
//      protected routes, and already-authenticated visitors away from
//      /login|/register.
// This is a UX optimization, not the security boundary: every backend call
// still independently verifies the token (JwtAuthGuard + TenantContextGuard)
// regardless of what middleware decided.
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  let accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const response = NextResponse.next();

  const needsRefresh = refreshToken && (!accessToken || isTokenExpiringSoon(accessToken));

  if (needsRefresh) {
    try {
      const refreshResponse = await fetch(`${apiOrigin()}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        cache: "no-store",
      });

      if (refreshResponse.ok) {
        const data = (await refreshResponse.json()) as { accessToken: string; refreshToken: string };
        accessToken = data.accessToken;
        response.cookies.set(ACCESS_TOKEN_COOKIE, data.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
        });
        response.cookies.set(REFRESH_TOKEN_COOKIE, data.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
        });
      } else {
        accessToken = undefined;
        response.cookies.delete(ACCESS_TOKEN_COOKIE);
        response.cookies.delete(REFRESH_TOKEN_COOKIE);
      }
    } catch {
      // AI/API service unreachable — fail closed on protected routes below,
      // but don't crash the request for public pages.
      accessToken = undefined;
    }
  }

  const isAuthenticated = Boolean(accessToken);

  if (!isAuthenticated && !isPublicPath) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthenticated && isPublicPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/health).*)"],
};
