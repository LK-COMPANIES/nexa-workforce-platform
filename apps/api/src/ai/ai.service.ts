import { BadGatewayException, HttpException, Injectable } from "@nestjs/common";
import { ApiConfigService } from "../config/config.service";

export interface JobAccepted {
  jobId: string;
  status: string;
}

export interface JobStatusResponse {
  jobId: string;
  agentType: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  promptVersion: string;
  result: unknown;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
}

// Proxies to apps/ai on the caller's behalf. Per the brief's architectural
// rules: Anthropic credentials stay entirely inside apps/ai (this service
// never sees them), and apps/ai independently re-verifies the forwarded
// token and derives organization_id from it — apps/api forwarding a token
// is a convenience, not a trust shortcut apps/ai relies on.
@Injectable()
export class AiService {
  constructor(private readonly config: ApiConfigService) {}

  async requestContractAudit(accessToken: string, contractId: string): Promise<JobAccepted> {
    const response = await this.forward("/agents/contract-audit", accessToken, { contract_id: contractId });
    const body = (await response.json()) as { job_id: string; status: string };
    return { jobId: body.job_id, status: body.status };
  }

  async getJobStatus(accessToken: string, jobId: string): Promise<JobStatusResponse> {
    const response = await this.fetchWithErrorHandling(
      `${this.config.env.AI_SERVICE_URL}/agents/jobs/${encodeURIComponent(jobId)}`,
      { method: "GET", headers: { Authorization: `Bearer ${accessToken}` } },
    );
    const body = (await response.json()) as {
      job_id: string;
      agent_type: string;
      status: JobStatusResponse["status"];
      prompt_version: string;
      result: unknown;
      error: string | null;
      created_at: string;
      completed_at: string | null;
    };
    return {
      jobId: body.job_id,
      agentType: body.agent_type,
      status: body.status,
      promptVersion: body.prompt_version,
      result: body.result,
      error: body.error,
      createdAt: body.created_at,
      completedAt: body.completed_at,
    };
  }

  private async forward(path: string, accessToken: string, body: unknown): Promise<Response> {
    return this.fetchWithErrorHandling(`${this.config.env.AI_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async fetchWithErrorHandling(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(url, init);
    } catch (error) {
      throw new BadGatewayException(
        `AI orchestration service is unreachable: ${error instanceof Error ? error.message : "unknown error"}`,
      );
    }

    if (!response.ok) {
      // Forward the AI service's own status code (404 unknown/cross-tenant
      // contract, 422 wrong contract type, 429 rate limited, 401 token
      // issue) rather than collapsing everything to a generic failure —
      // apps/web's existing ApiError hierarchy already knows how to render
      // each of these distinctly.
      const message = await this.extractErrorMessage(response);
      throw new HttpException(message, response.status);
    }

    return response;
  }

  private async extractErrorMessage(response: Response): Promise<string> {
    try {
      const body = (await response.clone().json()) as { detail?: unknown };
      if (typeof body.detail === "string") return body.detail;
      if (Array.isArray(body.detail)) return "AI orchestration service rejected the request as invalid";
    } catch {
      // Not JSON — fall through to a generic message.
    }
    return "AI orchestration service request failed";
  }
}
