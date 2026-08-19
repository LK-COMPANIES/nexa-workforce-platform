"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nexa/ui";
import { createPayrollRunAction, initialPayrollActionState } from "../../lib/payroll/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? "Creating…" : "Create run"}
    </Button>
  );
}

export function CreateRunDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useFormState(createPayrollRunAction, initialPayrollActionState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" aria-hidden />
          New payroll run
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create payroll run</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payrollPeriodStart">Period start</Label>
              <Input id="payrollPeriodStart" name="payrollPeriodStart" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payrollPeriodEnd">Period end</Label>
              <Input id="payrollPeriodEnd" name="payrollPeriodEnd" type="date" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="runType">Run type</Label>
            <Select name="runType" defaultValue="REGULAR">
              <SelectTrigger id="runType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="REGULAR">Regular</SelectItem>
                <SelectItem value="OFF_CYCLE">Off-cycle</SelectItem>
                <SelectItem value="CORRECTION">Correction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" defaultValue="KES" maxLength={3} required />
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
