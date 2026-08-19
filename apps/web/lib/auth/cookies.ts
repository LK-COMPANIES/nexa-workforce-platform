// httpOnly cookie names for the two JWTs. Set/read/cleared exclusively by
// server-side code (Server Actions, Route Handlers, Server Components via
// next/headers) — never exposed to client-side JavaScript. This is the
// entire reason the access token never needs to touch NEXT_PUBLIC_* or
// browser storage (brief §22/§23).
export const ACCESS_TOKEN_COOKIE = "nexa_access_token";
export const REFRESH_TOKEN_COOKIE = "nexa_refresh_token";

// Matches JWT_ACCESS_TTL / JWT_REFRESH_TTL defaults from apps/api's
// .env.example (15m / 7d) — the cookie's own maxAge is a courtesy (the
// backend independently expires/rejects the token regardless of what the
// browser does with the cookie), kept a little longer than the token's own
// lifetime so a client clock skew doesn't drop the cookie early.
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 20 * 60; // 20 minutes
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 8 * 24 * 60 * 60; // 8 days

export function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}
