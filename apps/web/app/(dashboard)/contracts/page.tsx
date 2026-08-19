import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@nexa/ui";
import { ApiErrorCard } from "../../../components/shared/ApiErrorCard";
import { EmptyState } from "../../../components/shared/EmptyState";
import { ContractsTable } from "../../../components/contracts/ContractsTable";
import { apiListContracts } from "../../../lib/api/contracts";

export const metadata = { title: "Contracts — Nexa Workforce Solutions" };

export default async function ContractsPage() {
  let contracts;
  try {
    contracts = await apiListContracts();
  } catch (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-slate-900">Contracts</h1>
        <ApiErrorCard error={error} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Contracts</h1>
          <p className="mt-1 text-sm text-slate-500">
            Employment Act 2007-compliant contracts with automated compliance validation.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/contracts/new">
            <Plus className="h-4 w-4" aria-hidden />
            New contract
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All contracts</CardTitle>
        </CardHeader>
        <CardContent>
          {contracts.length === 0 ? (
            <EmptyState
              title="No contracts yet"
              description="Generate a structured, compliance-validated contract to get started."
              action={
                <Button asChild size="sm">
                  <Link href="/contracts/new">New contract</Link>
                </Button>
              }
            />
          ) : (
            <ContractsTable contracts={contracts} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
