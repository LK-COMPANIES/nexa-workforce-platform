"use client";

import { useState, useTransition } from "react";
import { ChevronsUpDown, Loader2 } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nexa/ui";
import { switchOrganizationDirect } from "../../lib/auth/actions";
import type { MembershipSummary } from "../../types/api";

// The organization switcher NEVER lets the user type a UUID (brief §12) —
// clicking an item can only submit an organizationId taken from this
// component's own `memberships` prop, which comes from GET
// /auth/memberships (the caller's own authorized memberships). The backend
// independently re-validates the target membership regardless — this list
// is a convenience, not the security boundary.
export function OrgSwitcher({
  currentOrganizationName,
  memberships,
}: {
  currentOrganizationName: string;
  memberships: MembershipSummary[];
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const otherMemberships = memberships.filter((m) => m.status === "ACTIVE");

  function handleSwitch(organizationId: string) {
    setError(null);
    startTransition(async () => {
      const result = await switchOrganizationDirect(organizationId);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between" size="sm" disabled={isPending}>
          <span className="flex items-center gap-2 truncate">
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {currentOrganizationName}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Switch organization</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {otherMemberships.length === 0 ? (
          <p className="px-2 py-1.5 text-sm text-slate-500">No other organizations available.</p>
        ) : (
          otherMemberships.map((membership) => (
            <DropdownMenuItem
              key={membership.organizationId}
              onSelect={() => handleSwitch(membership.organizationId)}
              className="flex flex-col items-start"
            >
              <span className="font-medium text-slate-900">{membership.organizationDisplayName}</span>
              <span className="text-xs text-slate-500">{membership.roleName}</span>
            </DropdownMenuItem>
          ))
        )}
        {error && <p className="px-2 py-1.5 text-sm text-red-600">{error}</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
