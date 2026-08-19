import Link from "next/link";
import { Calculator } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { ApiErrorCard } from "../../../components/shared/ApiErrorCard";
import { EmptyState } from "../../../components/shared/EmptyState";
import { CreateRunDialog } from "../../../components/payroll/CreateRunDialog";
import { PayrollRunsTable } from "../../../components/payroll/PayrollRunsTable";
import { apiListPayrollRuns } from "../../../lib/api/payroll";

export const metadata = { title: "Payroll — Nexa Workforce Solutions" };

export default async function PayrollHubPage() {
  let runs;
  try {
    runs = await apiListPayrollRuns();
  } catch (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-slate-900">Statutory Payroll Hub</h1>
        <ApiErrorCard error={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Statutory Payroll Hub</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kenyan statutory payroll — PAYE, NSSF, SHIF, and Affordable Housing Levy.
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/payroll/calculator">
              <Calculator className="h-4 w-4" aria-hidden />
              Gross-to-net calculator
            </Link>
          </Button>
          <CreateRunDialog />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payroll runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <EmptyState
              title="No payroll runs yet"
              description="Create your first payroll run to calculate statutory deductions for your active employees."
            />
          ) : (
            <PayrollRunsTable runs={runs} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
