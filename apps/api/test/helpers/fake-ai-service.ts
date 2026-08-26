import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";

// A deliberately minimal stand-in for apps/ai's HTTP surface — NOT a mock
// of the NestJS AiService/AiController under test, which run for real
// against this. This is what lets the E2E suite prove the real
// apps/api <-> apps/ai HTTP contract (auth-token forwarding, response
// shape, status-code translation) without ever needing Python or a live
// Anthropic key (brief §29 / final principle #8: no live AI dependency for
// ordinary pull-request CI). apps/ai's OWN test suite (apps/ai/app/tests)
// separately covers everything on its side of this same contract with the
// Anthropic SDK itself mocked.
export interface FakeAiService {
  server: Server;
  url: string;
  lastAuthorizationHeader: string | undefined;
  close: () => Promise<void>;
}

export async function startFakeAiService(): Promise<FakeAiService> {
  const state: { lastAuthorizationHeader: string | undefined } = { lastAuthorizationHeader: undefined };

  const server = createServer((req, res) => {
    state.lastAuthorizationHeader = req.headers.authorization;

    if (req.method === "POST" && req.url === "/agents/contract-audit") {
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ job_id: randomUUID(), status: "PENDING" }));
      return;
    }

    if (req.method === "GET" && req.url?.startsWith("/agents/jobs/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          job_id: req.url.split("/").pop(),
          agent_type: "CONTRACT_AUDIT",
          status: "SUCCEEDED",
          prompt_version: "contract-audit-v1",
          result: {
            summary: "Fake AI service E2E fixture result — not a real Claude response.",
            overall_assessment: "LOOKS_SOUND",
            findings: [],
            disclaimer: "This is AI-generated advisory analysis, not legal advice.",
          },
          error: null,
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }),
      );
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ detail: "not found in fake AI service" }));
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Fake AI service failed to bind to a port");
  }

  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
    get lastAuthorizationHeader() {
      return state.lastAuthorizationHeader;
    },
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}
