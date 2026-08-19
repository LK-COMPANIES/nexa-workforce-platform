"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Label, Textarea } from "@nexa/ui";
import {
  approvePayrollRunAction,
  calculatePayrollRunAction,
  finalizePayrollRunAction,
  voidPayrollRunAction,
} from "../../lib/payroll/actions";
import type { PayrollRunStatus } from "../../types/api";

// Mirrors apps/api/src/payroll/payroll-run-lifecycle.ts exactly — the UI
// only ever OFFERS a transition the backend would actually accept, but the
// backend re-validates regardless (brief §15: "the UI must not bypass
// backend state validation" — this is a convenience, not the enforcement).
const CAN_CALCULATE: PayrollRunStatus[] = ["DRAFT", "CALCULATED", "UNDER_REVIEW", "FAILED"];
const CAN_APPROVE: PayrollRunStatus[] = ["CALCULATED", "UNDER_REVIEW"];
const CAN_FINALIZE: PayrollRunStatus[] = ["APPROVED"];
const CAN_VOID: PayrollRunStatus[] = ["DRAFT", "CALCULATED", "UNDER_REVIEW", "APPROVED", "FAILED"];

export function RunLifecycleActions({ runId, status }: { runId: string; status: PayrollRunStatus }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [voidDialogOpen, setVoidDialogOpen] = useState(false);
  const [voidReason, setVoidReason] = useState("");

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (status === "CALCULATING") {
    return <p className="text-sm text-slate-500">Calculating… this page will update automatically.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {CAN_CALCULATE.includes(status) && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => calculatePayrollRunAction(runId))}>
            {status === "FAILED" || status === "DRAFT" ? "Calculate" : "Recalculate"}
          </Button>
        )}
        {CAN_APPROVE.includes(status) && (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => run(() => approvePayrollRunAction(runId))}
          >
            Approve
          </Button>
        )}
        {CAN_FINALIZE.includes(status) && (
          <Button size="sm" disabled={isPending} onClick={() => run(() => finalizePayrollRunAction(runId))}>
            Finalize
          </Button>
        )}
        {CAN_VOID.includes(status) && (
          <Button size="sm" variant="destructive" disabled={isPending} onClick={() => setVoidDialogOpen(true)}>
            Void
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <Dialog open={voidDialogOpen} onOpenChange={setVoidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Void payroll run</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="voidReason">Reason</Label>
            <Textarea id="voidReason" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              disabled={isPending}
              onClick={() => {
                setVoidDialogOpen(false);
                run(() => voidPayrollRunAction(runId, voidReason));
              }}
            >
              Confirm void
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
