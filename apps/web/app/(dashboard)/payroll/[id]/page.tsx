import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { ApiErrorCard } from "../../../../components/shared/ApiErrorCard";
import { EmptyState } from "../../../../components/shared/EmptyState";
import { PayrollRecordsTable } from "../../../../components/payroll/PayrollRecordsTable";
import { PayrollStatusBadge } from "../../../../components/payroll/PayrollStatusBadge";
import { RunLifecycleActions } from "../../../../components/payroll/RunLifecycleActions";
import { NotFoundApiError } from "../../../../lib/api/errors";
import { apiGetPayrollRun, apiGetPayrollRunRecords, apiGetPayrollRunSummary } from "../../../../lib/api/payroll";

function money(value: number | string, currency: string): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

export default async function PayrollRunDetailPage({ params }: { params: { id: string } }) {
  let run;
  try {
    run = await apiGetPayrollRun(params.id);
  } catch (error) {
    if (error instanceof NotFoundApiError) {
      notFound();
    }
    return <ApiErrorCard error={error} />;
  }

  const [recordsResult, summaryResult] = await Promise.allSettled([
    apiGetPayrollRunRecords(params.id),
    apiGetPayrollRunSummary(params.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900">
              {new Date(run.payrollPeriodStart).toLocaleDateString()} –{" "}
              {new Date(run.payrollPeriodEnd).toLocaleDateString()}
            </h1>
            <PayrollStatusBadge status={run.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {run.runType.replace(/_/g, " ")} · {run.currency}
          </p>
          {run.failureReason && <p className="mt-2 text-sm text-red-600">Last failure: {run.failureReason}</p>}
          {run.voidedReason && <p className="mt-2 text-sm text-slate-500">Voided: {run.voidedReason}</p>}
        </div>
        <RunLifecycleActions runId={run.id} status={run.status} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Statutory summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summaryResult.status === "rejected" ? (
            <ApiErrorCard error={summaryResult.reason} />
          ) : summaryResult.value.employeeCount === 0 ? (
            <EmptyState title="Not yet calculated" description="Run the calculation to see the statutory summary." />
          ) : (
            <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              {(
                [
                  ["Employees", summaryResult.value.employeeCount, false],
                  ["Gross payroll", summaryResult.value.grossPayroll, true],
                  ["Taxable payroll", summaryResult.value.taxablePayroll, true],
                  ["PAYE", summaryResult.value.paye, true],
                  ["NSSF (employee)", summaryResult.value.nssfEmployee, true],
                  ["NSSF (employer)", summaryResult.value.nssfEmployer, true],
                  ["SHIF", summaryResult.value.shif, true],
                  ["Housing Levy (employee)", summaryResult.value.housingLevyEmployee, true],
                  ["Housing Levy (employer)", summaryResult.value.housingLevyEmployer, true],
                  ["Other deductions", summaryResult.value.otherDeductions, true],
                  ["Net payroll", summaryResult.value.netPayroll, true],
                  ["Total employment cost", summaryResult.value.totalEmploymentCost, true],
                ] as const
              ).map(([label, value, isMoney]) => (
                <div key={label}>
                  <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
                  <dd className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                    {isMoney ? money(value, run.currency) : value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Employee payroll records</CardTitle>
        </CardHeader>
        <CardContent>
          {recordsResult.status === "rejected" ? (
            <ApiErrorCard error={recordsResult.reason} />
          ) : recordsResult.value.length === 0 ? (
            <EmptyState title="No records yet" description="Records appear here once this run has been calculated." />
          ) : (
            <PayrollRecordsTable records={recordsResult.value} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
