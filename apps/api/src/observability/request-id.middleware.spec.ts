import type { Request, Response } from "express";
import { getRequestId } from "./request-context";
import { RequestIdMiddleware } from "./request-id.middleware";

function makeResponse(): Response {
  const headers: Record<string, string> = {};
  return {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    getHeader: (name: string) => headers[name],
  } as unknown as Response;
}

describe("RequestIdMiddleware", () => {
  it("mints a new request ID when no X-Request-Id header is present", () => {
    const middleware = new RequestIdMiddleware();
    const req = { headers: {} } as Request;
    const res = makeResponse();
    let idSeenInsideHandler: string | undefined;

    middleware.use(req, res, () => {
      idSeenInsideHandler = getRequestId();
    });

    expect(idSeenInsideHandler).toEqual(expect.any(String));
    expect(res.getHeader("X-Request-Id")).toBe(idSeenInsideHandler);
  });

  it("reuses an inbound X-Request-Id header instead of minting a new one", () => {
    const middleware = new RequestIdMiddleware();
    const req = { headers: { "x-request-id": "caller-supplied-id" } } as unknown as Request;
    const res = makeResponse();
    let idSeenInsideHandler: string | undefined;

    middleware.use(req, res, () => {
      idSeenInsideHandler = getRequestId();
    });

    expect(idSeenInsideHandler).toBe("caller-supplied-id");
    expect(res.getHeader("X-Request-Id")).toBe("caller-supplied-id");
  });

  it("generates a different request ID for two separate requests with no header", () => {
    const middleware = new RequestIdMiddleware();
    const ids: (string | undefined)[] = [];

    middleware.use({ headers: {} } as Request, makeResponse(), () => ids.push(getRequestId()));
    middleware.use({ headers: {} } as Request, makeResponse(), () => ids.push(getRequestId()));

    expect(ids[0]).not.toBe(ids[1]);
  });

  it("calls next() exactly once", () => {
    const middleware = new RequestIdMiddleware();
    const next = jest.fn();
    middleware.use({ headers: {} } as Request, makeResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
