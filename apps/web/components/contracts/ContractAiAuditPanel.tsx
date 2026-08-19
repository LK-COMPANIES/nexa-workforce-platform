"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertCircle, Info, Lightbulb, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { getAiJobStatusAction, requestAiContractAuditAction } from "../../lib/contracts/actions";
import type { AiContractAuditFinding, AiContractAuditSeverity, AiJobStatusResponse } from "../../types/api";

const POLL_INTERVAL_MS = 3000;

const SEVERITY_BADGE: Record<AiContractAuditSeverity, "secondary" | "warning" | "destructive"> = {
  INFO: "secondary",
  ADVISORY: "warning",
  CONCERN: "destructive",
};

const SEVERITY_ICON: Record<AiContractAuditSeverity, typeof Info> = {
  INFO: Info,
  ADVISORY: Lightbulb,
  CONCERN: AlertCircle,
};

function FindingRow({ finding }: { finding: AiContractAuditFinding }) {
  const Icon = SEVERITY_ICON[finding.severity];
  return (
    <div className="flex gap-3 rounded-md border border-slate-200 p-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Badge variant={SEVERITY_BADGE[finding.severity]} className="text-[10px]">
            {finding.severity}
          </Badge>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            {finding.category.replace(/_/g, " ")}
          </span>
        </div>
        <p className="text-sm text-slate-900">{finding.observation}</p>
        <p className="text-sm text-slate-600">{finding.recommendation}</p>
      </div>
    </div>
  );
}

// Deliberately styled and labeled distinctly from ComplianceFindingsPanel
// (brief §20: AI-generated legal analysis must be clearly distinguished
// from deterministic compliance results) — a violet accent, a "Sparkles"
// icon, an "AI-generated" badge on every render path, and the agent's own
// disclaimer text always shown, never abbreviated.
export function ContractAiAuditPanel({ contractId }: { contractId: string }) {
  const [job, setJob] = useState<AiJobStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, startTransition] = useTransition();
  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollHandle.current) clearInterval(pollHandle.current);
    };
  }, []);

  function pollJob(jobId: string) {
    pollHandle.current = setInterval(async () => {
      const result = await getAiJobStatusAction(jobId);
      if (result.error) {
        setError(result.error);
        if (pollHandle.current) clearInterval(pollHandle.current);
        return;
      }
      if (result.job) {
        setJob(result.job);
        if (result.job.status === "SUCCEEDED" || result.job.status === "FAILED") {
          if (pollHandle.current) clearInterval(pollHandle.current);
        }
      }
    }, POLL_INTERVAL_MS);
  }

  function handleStart() {
    setError(null);
    setJob(null);
    startTransition(async () => {
      const result = await requestAiContractAuditAction(contractId);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.jobId) {
        setJob({
          jobId: result.jobId,
          agentType: "CONTRACT_AUDIT",
          status: "PENDING",
          promptVersion: "",
          result: null,
          error: null,
          createdAt: new Date().toISOString(),
          completedAt: null,
        });
        pollJob(result.jobId);
      }
    });
  }

  const isRunning = job?.status === "PENDING" || job?.status === "RUNNING";

  return (
    <Card className="border-violet-200">
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
            <CardTitle>AI advisory review</CardTitle>
            <Badge variant="outline" className="border-violet-300 text-violet-700">
              AI-generated
            </Badge>
          </div>
          <Button size="sm" variant="outline" onClick={handleStart} disabled={isStarting || isRunning}>
            {isRunning ? "Reviewing…" : "Run AI audit"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-slate-500">
          Optional advisory second opinion on contract drafting quality — separate from, and never a substitute
          for, the deterministic Employment Act compliance evaluation above.
        </p>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>AI audit failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isRunning && <p className="text-sm text-slate-500">Analyzing contract…</p>}

        {job?.status === "FAILED" && (
          <Alert variant="destructive">
            <AlertTitle>AI audit failed</AlertTitle>
            <AlertDescription>{job.error ?? "The AI orchestration service reported a failure."}</AlertDescription>
          </Alert>
        )}

        {job?.status === "SUCCEEDED" && job.result && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  job.result.overall_assessment === "LOOKS_SOUND"
                    ? "success"
                    : job.result.overall_assessment === "MINOR_SUGGESTIONS"
                      ? "warning"
                      : "destructive"
                }
              >
                {job.result.overall_assessment.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="text-sm text-slate-900">{job.result.summary}</p>
            {job.result.findings.length > 0 && (
              <div className="flex flex-col gap-2">
                {job.result.findings.map((finding, index) => (
                  <FindingRow key={index} finding={finding} />
                ))}
              </div>
            )}
            <p className="text-xs italic text-slate-500">{job.result.disclaimer}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
