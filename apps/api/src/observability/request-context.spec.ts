import { annotateRequestContext, getRequestContext, getRequestId, runWithRequestContext } from "./request-context";

describe("request-context (AsyncLocalStorage)", () => {
  it("returns undefined outside of any request context", () => {
    expect(getRequestContext()).toBeUndefined();
    expect(getRequestId()).toBeUndefined();
  });

  it("makes the context available synchronously inside runWithRequestContext", () => {
    runWithRequestContext({ requestId: "req-1" }, () => {
      expect(getRequestId()).toBe("req-1");
    });
  });

  it("makes the context available across an await boundary inside the same call", async () => {
    await runWithRequestContext({ requestId: "req-2" }, async () => {
      await Promise.resolve();
      expect(getRequestId()).toBe("req-2");
    });
  });

  it("isolates concurrent contexts from each other", async () => {
    const results: string[] = [];

    const a = runWithRequestContext({ requestId: "req-a" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      results.push(getRequestId()!);
    });
    const b = runWithRequestContext({ requestId: "req-b" }, async () => {
      results.push(getRequestId()!);
    });

    await Promise.all([a, b]);
    expect(results).toContain("req-a");
    expect(results).toContain("req-b");
  });

  it("annotateRequestContext mutates the currently active context in place", () => {
    runWithRequestContext({ requestId: "req-3" }, () => {
      annotateRequestContext({ organizationId: "org-1", userId: "user-1" });
      const context = getRequestContext();
      expect(context?.requestId).toBe("req-3");
      expect(context?.organizationId).toBe("org-1");
      expect(context?.userId).toBe("user-1");
    });
  });

  it("annotateRequestContext is a safe no-op when no context is running", () => {
    expect(() => annotateRequestContext({ organizationId: "org-1" })).not.toThrow();
  });

  it("does not leak annotations from one request context into a later, unrelated one", () => {
    runWithRequestContext({ requestId: "req-4" }, () => {
      annotateRequestContext({ organizationId: "org-leaky" });
    });
    runWithRequestContext({ requestId: "req-5" }, () => {
      expect(getRequestContext()?.organizationId).toBeUndefined();
    });
  });
});
