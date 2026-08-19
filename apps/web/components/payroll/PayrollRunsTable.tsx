import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@nexa/ui";
import { PayrollStatusBadge } from "./PayrollStatusBadge";
import type { PayrollRunSummaryRow } from "../../types/api";

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 0 }).format(
    Number(amount),
  );
}

export function PayrollRunsTable({ runs }: { runs: PayrollRunSummaryRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Period</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Employees</TableHead>
          <TableHead className="text-right">Net payroll</TableHead>
          <TableHead className="sr-only">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {runs.map((run) => (
          <TableRow key={run.id}>
            <TableCell className="font-medium text-slate-900">
              {new Date(run.payrollPeriodStart).toLocaleDateString()} –{" "}
              {new Date(run.payrollPeriodEnd).toLocaleDateString()}
            </TableCell>
            <TableCell className="text-slate-600">{run.runType.replace(/_/g, " ")}</TableCell>
            <TableCell>
              <PayrollStatusBadge status={run.status} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{run.employeeCount}</TableCell>
            <TableCell className="text-right tabular-nums">
              {formatMoney(run.netPayrollTotal, run.currency)}
            </TableCell>
            <TableCell className="text-right">
              <Link href={`/payroll/${run.id}`} className="text-sm font-medium text-slate-900 underline underline-offset-4">
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
