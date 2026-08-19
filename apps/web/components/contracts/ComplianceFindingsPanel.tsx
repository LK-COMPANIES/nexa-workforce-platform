import { AlertCircle, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle, Badge } from "@nexa/ui";
import { ComplianceStatusBadge } from "./ComplianceStatusBadge";
import type { ComplianceEvaluationRow, ComplianceViolationRow } from "../../types/api";

function FindingCard({ finding, tone }: { finding: ComplianceViolationRow; tone: "error" | "warning" }) {
  return (
    <Alert variant={tone === "error" ? "destructive" : "warning"}>
      {tone === "error" ? <AlertCircle className="h-4 w-4" aria-hidden /> : <AlertTriangle className="h-4 w-4" aria-hidden />}
      <AlertTitle className="flex items-center gap-2">
        {finding.message}
        <Badge variant="outline" className="font-mono text-[10px]">
          {finding.field}
        </Badge>
      </AlertTitle>
      <AlertDescription>
        <p className="text-sm">{finding.remediation}</p>
        <p className="mt-1 text-xs text-slate-500">Legal basis: {finding.legalBasis}</p>
      </AlertDescription>
    </Alert>
  );
}

// Deterministic Phase 3 compliance engine output ONLY — this component
// never renders AI content (brief §20: "Deterministic compliance results
// from Phase 3 must remain clearly distinguished from AI suggestions." —
// see ContractAiAuditPanel for the separately-labeled AI section).
export function ComplianceFindingsPanel({ evaluation }: { evaluation: ComplianceEvaluationRow }) {
  const { findings } = evaluation;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <ComplianceStatusBadge status={evaluation.status} />
        <span className="text-sm text-slate-500">
          Score: <span className="font-medium text-slate-900">{findings.score}%</span>
        </span>
        <span className="text-xs text-slate-400">
          Evaluated {new Date(evaluation.createdAt).toLocaleString()} · engine v{evaluation.ruleEngineVersion}
        </span>
      </div>

      {findings.violations.length === 0 && findings.warnings.length === 0 && (
        <Alert variant="success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          <AlertTitle>No violations found</AlertTitle>
          <AlertDescription>All deterministic Employment Act checks passed for this contract.</AlertDescription>
        </Alert>
      )}

      {findings.violations.map((violation, index) => (
        <FindingCard key={`violation-${index}`} finding={violation} tone="error" />
      ))}
      {findings.warnings.map((warning, index) => (
        <FindingCard key={`warning-${index}`} finding={warning} tone="warning" />
      ))}

      {findings.passedChecks.length > 0 && (
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Passed checks</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {findings.passedChecks.map((check) => (
              <Badge key={check} variant="secondary">
                {check}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
