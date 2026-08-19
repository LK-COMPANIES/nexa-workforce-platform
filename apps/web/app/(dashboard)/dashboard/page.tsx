import { Banknote, ShieldCheck, Users, Headset } from "lucide-react";
import { Badge } from "@nexa/ui";
import { ApiErrorCard } from "../../../components/shared/ApiErrorCard";
import { DivisionCard } from "../../../components/dashboard/DivisionCard";
import { NoOperationalData, StatCard } from "../../../components/dashboard/StatCard";
import { apiGetComplianceSummary } from "../../../lib/api/contracts";
import { apiListEmployees } from "../../../lib/api/employees";
import { apiListPayrollRuns, apiGetPayrollRunSummary } from "../../../lib/api/payroll";
import type { ComplianceSummary, EmployeeRow, PayrollRunSummaryReport, PayrollRunSummaryRow } from "../../../types/api";

export const metadata = { title: "Dashboard — Nexa Workforce Solutions" };

const DIVISIONS = [
  "Human Capital Solutions",
  "Workforce Solutions",
  "Executive Search & Leadership Advisory",
  "Customer Experience Solutions",
  "Contact Centre & BPO",
  "HR Audit & Compliance",
  "Business Advisory & Transformation",
  "HR Technology & Digital Transformation",
  "Research, Analytics & Workforce Insights",
];

type SafeResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

async function safe<T>(fn: () => Promise<T>): Promise<SafeResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return { ok: false, error };
  }
}

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

async function WorkforceSection() {
  const result = await safe<EmployeeRow[]>(apiListEmployees);
  if (!result.ok) {
    return (
      <StatCard icon={Users} label="Total Workforce" value="—">
        <ApiErrorCard error={result.error} />
      </StatCard>
    );
  }
  const active = result.data.filter((e) => e.status === "ACTIVE").length;
  return (
    <StatCard
      icon={Users}
      label="Total Workforce"
      value={result.data.length}
      helpText={`${active} active · ${result.data.length - active} inactive`}
    />
  );
}

async function PayrollLiabilitySection() {
  const runsResult = await safe<PayrollRunSummaryRow[]>(apiListPayrollRuns);
  if (!runsResult.ok) {
    return (
      <StatCard icon={Banknote} label="Payroll Liability" value="—">
        <ApiErrorCard error={runsResult.error} />
      </StatCard>
    );
  }
  const latestCalculated = runsResult.data
    .filter((run) => run.status !== "DRAFT" && run.status !== "FAILED")
    .sort((a, b) => new Date(b.payrollPeriodStart).getTime() - new Date(a.payrollPeriodStart).getTime())[0];

  if (!latestCalculated) {
    return (
      <StatCard icon={Banknote} label="Payroll Liability" value="—">
        <NoOperationalData />
      </StatCard>
    );
  }

  const summaryResult = await safe<PayrollRunSummaryReport>(() => apiGetPayrollRunSummary(latestCalculated.id));
  if (!summaryResult.ok) {
    return (
      <StatCard icon={Banknote} label="Payroll Liability" value="—">
        <ApiErrorCard error={summaryResult.error} />
      </StatCard>
    );
  }
  const s = summaryResult.data;
  return (
    <StatCard
      icon={Banknote}
      label="Payroll Liability"
      value={formatMoney(s.netPayroll, latestCalculated.currency)}
      helpText={`Period ending ${new Date(latestCalculated.payrollPeriodEnd).toLocaleDateString()}`}
    >
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
        <dt>PAYE</dt>
        <dd className="text-right text-slate-700">{formatMoney(s.paye, latestCalculated.currency)}</dd>
        <dt>NSSF (employer)</dt>
        <dd className="text-right text-slate-700">{formatMoney(s.nssfEmployer, latestCalculated.currency)}</dd>
        <dt>SHIF</dt>
        <dd className="text-right text-slate-700">{formatMoney(s.shif, latestCalculated.currency)}</dd>
        <dt>Housing Levy (employer)</dt>
        <dd className="text-right text-slate-700">
          {formatMoney(s.housingLevyEmployer, latestCalculated.currency)}
        </dd>
      </dl>
    </StatCard>
  );
}

async function ComplianceSection() {
  const result = await safe<ComplianceSummary>(apiGetComplianceSummary);
  if (!result.ok) {
    return (
      <StatCard icon={ShieldCheck} label="Compliance Health Index" value="—">
        <ApiErrorCard error={result.error} />
      </StatCard>
    );
  }
  const s = result.data;
  const healthIndex = s.evaluatedContracts === 0 ? null : Math.round((s.PASS / s.evaluatedContracts) * 100);

  return (
    <StatCard
      icon={ShieldCheck}
      label="Compliance Health Index"
      value={healthIndex === null ? "—" : `${healthIndex}%`}
      helpText={`${s.evaluatedContracts} of ${s.totalContracts} contracts evaluated`}
    >
      <div className="mt-3 flex flex-wrap gap-1.5">
        {s.FAIL > 0 && <Badge variant="destructive">{s.FAIL} critical</Badge>}
        {s.REQUIRES_HUMAN_REVIEW > 0 && <Badge variant="warning">{s.REQUIRES_HUMAN_REVIEW} needs review</Badge>}
        {s.WARNING > 0 && <Badge variant="warning">{s.WARNING} warnings</Badge>}
        {s.neverEvaluated > 0 && <Badge variant="secondary">{s.neverEvaluated} not yet evaluated</Badge>}
        {s.totalContracts === 0 && <NoOperationalData />}
      </div>
    </StatCard>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Executive Overview</h1>
        <p className="mt-1 text-sm text-slate-500">
          Operational intelligence across your organization. Figures below are verified metrics from live records.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <WorkforceSection />
        <PayrollLiabilitySection />
        <ComplianceSection />
        <StatCard icon={Headset} label="Active BPO Seats" value="—">
          <NoOperationalData />
        </StatCard>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">Nexa Operational Divisions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Each division activates once its own operational data source is connected.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DIVISIONS.map((division) => (
            <DivisionCard key={division} name={division} />
          ))}
        </div>
      </div>
    </div>
  );
}
