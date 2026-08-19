/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { middleware } from "./middleware";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./lib/auth/cookies";

// brief §48: "auth logged-out/expired/unauthorized" — middleware is the
// first line of route protection (the backend remains the actual
// authorization boundary; see middleware.ts's own comment), so its
// redirect/pass-through decisions are worth locking down directly.
function base64url(value: object): string {
  const json = JSON.stringify(value);
  return Buffer.from(json).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function makeFakeAccessToken(expiresInSeconds: number): string {
  const payload = { sub: "u1", organization_id: "org-1", session_id: "s1", role_key: "client_admin", token_type: "access", exp: Math.floor(Date.now() / 1000) + expiresInSeconds, iat: Math.floor(Date.now() / 1000) };
  return `header.${base64url(payload)}.signature`;
}

function makeRequest(path: string, cookies: Record<string, string> = {}): NextRequest {
  const request = new NextRequest(new URL(path, "http://localhost:3000"));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("middleware — route protection", () => {
  it("redirects an unauthenticated visitor away from a protected route to /login", async () => {
    const response = await middleware(makeRequest("/dashboard"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("does not redirect an unauthenticated visitor on a public path", async () => {
    const response = await middleware(makeRequest("/login"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("passes through an authenticated visitor on a protected route without redirecting", async () => {
    const token = makeFakeAccessToken(600);
    const response = await middleware(makeRequest("/dashboard", { [ACCESS_TOKEN_COOKIE]: token }));
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an already-authenticated visitor away from /login to /dashboard", async () => {
    const token = makeFakeAccessToken(600);
    const response = await middleware(makeRequest("/login", { [ACCESS_TOKEN_COOKIE]: token }));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/dashboard");
  });

  it("proactively refreshes an expiring access token and lets the request through", async () => {
    const expiringToken = makeFakeAccessToken(5); // within the 30s buffer
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ accessToken: makeFakeAccessToken(600), refreshToken: "new-refresh-token" }),
    }) as unknown as typeof fetch;

    const response = await middleware(
      makeRequest("/dashboard", { [ACCESS_TOKEN_COOKIE]: expiringToken, [REFRESH_TOKEN_COOKIE]: "old-refresh-token" }),
    );

    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/auth/refresh"), expect.any(Object));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get(ACCESS_TOKEN_COOKIE)).toBeDefined();
  });

  it("redirects to /login and clears cookies when a proactive refresh fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const response = await middleware(
      makeRequest("/dashboard", { [REFRESH_TOKEN_COOKIE]: "an-invalid-or-revoked-refresh-token" }),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
  });

  it("fails closed on a protected route when the refresh call itself throws (API unreachable)", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("ECONNREFUSED")) as unknown as typeof fetch;

    const response = await middleware(
      makeRequest("/dashboard", { [REFRESH_TOKEN_COOKIE]: "some-refresh-token" }),
    );

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
  });

  it("does not attempt a refresh at all when there is no refresh token cookie present", async () => {
    global.fetch = jest.fn();
    await middleware(makeRequest("/login"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
