import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  organizationId?: string;
  userId?: string;
}

// Node's built-in AsyncLocalStorage — no logging library dependency needed
// to thread a request ID through an async call chain (brief §42: "do not
// introduce a heavyweight observability stack unless justified"). Every
// `await` inside the same request's call tree sees the same store, without
// passing requestId through every function signature by hand.
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

// Called once TenantContextGuard has resolved the caller's identity, so
// subsequent log lines in the same request (including the access log
// written after the handler returns) carry organizationId/userId without
// any controller/service needing to pass them into a logger call
// explicitly. Safe to call multiple times — a no-op if no context is
// running (e.g. a route with no guards).
export function annotateRequestContext(fields: Partial<Omit<RequestContext, "requestId">>): void {
  const store = storage.getStore();
  if (store) {
    Object.assign(store, fields);
  }
}
