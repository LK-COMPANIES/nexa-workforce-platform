import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nexa/ui";
import type { PayrollRecordRow } from "../../types/api";

function money(value: string, currency: string): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    Number(value),
  );
}

// Employee-level payroll records for one run — server-paginated by the
// backend's own PayrollRun scope (one run's records, never the org's
// entire history at once), per brief §16.
export function PayrollRecordsTable({ records }: { records: PayrollRecordRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead className="text-right">Gross</TableHead>
          <TableHead className="text-right">PAYE</TableHead>
          <TableHead className="text-right">NSSF (emp.)</TableHead>
          <TableHead className="text-right">SHIF</TableHead>
          <TableHead className="text-right">Housing Levy</TableHead>
          <TableHead className="text-right">Net pay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {records.map((record) => (
          <TableRow key={record.id}>
            <TableCell className="font-mono text-xs text-slate-500">{record.employeeId.slice(0, 8)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(record.grossPay, record.currency)}</TableCell>
            <TableCell className="text-right tabular-nums">{money(record.payeAmount, record.currency)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {money(record.nssfEmployeeAmount, record.currency)}
            </TableCell>
            <TableCell className="text-right tabular-nums">{money(record.shifAmount, record.currency)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {money(record.housingLevyEmployeeAmount, record.currency)}
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums text-slate-900">
              {money(record.netPay, record.currency)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
