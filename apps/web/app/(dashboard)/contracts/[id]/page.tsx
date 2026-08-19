import { notFound } from "next/navigation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { ApiErrorCard } from "../../../../components/shared/ApiErrorCard";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { ComplianceFindingsPanel } from "../../../../components/contracts/ComplianceFindingsPanel";
import { ContractAiAuditPanel } from "../../../../components/contracts/ContractAiAuditPanel";
import { ContractRemediationForm } from "../../../../components/contracts/ContractRemediationForm";
import { EvaluateComplianceButton } from "../../../../components/contracts/EvaluateComplianceButton";
import { apiGetContract, apiListContractCompliance } from "../../../../lib/api/contracts";
import { NotFoundApiError } from "../../../../lib/api/errors";
import type { ContractRow, ContractStatus } from "../../../../types/api";

const STATUS_VARIANT: Record<ContractStatus, "secondary" | "outline" | "success" | "destructive" | "warning"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  ACTIVE: "success",
  SUSPENDED: "warning",
  TERMINATED: "destructive",
  EXPIRED: "outline",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-900">{value}</dd>
    </div>
  );
}

function money(value: string | null, currency: string | null): string {
  if (!value) return "—";
  const amount = Number(value);
  return `${currency ?? ""} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function date(value: string | null): string {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default async function ContractDetailPage({ params }: { params: { id: string } }) {
  let contract: ContractRow;
  try {
    contract = await apiGetContract(params.id);
  } catch (error) {
    if (error instanceof NotFoundApiError) notFound();
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-slate-900">Contract</h1>
        <ApiErrorCard error={error} />
      </div>
    );
  }

  const evaluationsResult = await apiListContractCompliance(contract.id).catch((error: unknown) => error);
  const evaluations = Array.isArray(evaluationsResult) ? evaluationsResult : null;
  const evaluationsError = Array.isArray(evaluationsResult) ? null : evaluationsResult;
  const latestEvaluation = evaluations?.[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">{contract.title}</h1>
            <Badge variant={STATUS_VARIANT[contract.status]}>{contract.status.replace(/_/g, " ")}</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {contract.contractType.replace(/_/g, " ")}
            {contract.referenceCode ? ` · ${contract.referenceCode}` : ""}
          </p>
        </div>
        <EvaluateComplianceButton contractId={contract.id} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contract terms</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <DetailRow label="Job title" value={contract.jobTitle ?? "—"} />
              <DetailRow label="Place of work" value={contract.workLocation ?? "—"} />
              <DetailRow label="Commencement date" value={date(contract.effectiveDate)} />
              <DetailRow label="Expiration date" value={date(contract.expirationDate)} />
              <DetailRow label="Remuneration" value={money(contract.baseCompensation, contract.currency)} />
              <DetailRow label="Payment interval" value={contract.paymentInterval ?? "—"} />
              <DetailRow label="Working hours / week" value={contract.workingHoursPerWeek ?? "—"} />
              <DetailRow label="Notice period" value={contract.noticePeriodDays !== null ? `${contract.noticePeriodDays} days` : "—"} />
              <DetailRow label="Initial probation" value={contract.probationMonths !== null ? `${contract.probationMonths} months` : "—"} />
              <DetailRow
                label="Probation extension"
                value={
                  contract.probationExtendedMonths
                    ? `${contract.probationExtendedMonths} months (consent: ${contract.probationExtensionConsent ? "yes" : "no"})`
                    : "None"
                }
              />
              {contract.jobDescription && (
                <div className="col-span-2">
                  <DetailRow label="Job description" value={contract.jobDescription} />
                </div>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance findings</CardTitle>
          </CardHeader>
          <CardContent>
            {evaluationsError ? (
              <ApiErrorCard error={evaluationsError} />
            ) : latestEvaluation ? (
              <ComplianceFindingsPanel evaluation={latestEvaluation} />
            ) : (
              <EmptyState
                title="Not yet evaluated"
                description="Run compliance validation to check this contract against the Employment Act 2007 rule engine."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <ContractAiAuditPanel contractId={contract.id} />

      <ContractRemediationForm contract={contract} />
    </div>
  );
}
