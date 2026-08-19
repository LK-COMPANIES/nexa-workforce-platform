import Link from "next/link";
import { Badge, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@nexa/ui";
import type { ContractRow } from "../../types/api";

const STATUS_VARIANT: Record<ContractRow["status"], "secondary" | "outline" | "success" | "destructive" | "warning"> = {
  DRAFT: "secondary",
  PENDING_APPROVAL: "warning",
  ACTIVE: "success",
  SUSPENDED: "warning",
  TERMINATED: "destructive",
  EXPIRED: "outline",
};

export function ContractsTable({ contracts }: { contracts: ContractRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Effective date</TableHead>
          <TableHead className="sr-only">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((contract) => (
          <TableRow key={contract.id}>
            <TableCell className="font-medium text-slate-900">{contract.title}</TableCell>
            <TableCell className="text-slate-600">{contract.contractType.replace(/_/g, " ")}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[contract.status]}>{contract.status.replace(/_/g, " ")}</Badge>
            </TableCell>
            <TableCell className="text-slate-600">{new Date(contract.effectiveDate).toLocaleDateString()}</TableCell>
            <TableCell className="text-right">
              <Link
                href={`/contracts/${contract.id}`}
                className="text-sm font-medium text-slate-900 underline underline-offset-4"
              >
                View
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
