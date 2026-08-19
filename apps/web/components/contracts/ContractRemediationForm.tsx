"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, Input, Label } from "@nexa/ui";
import type { UpdateContractInput } from "@nexa/validation";
import { updateContractAction } from "../../lib/contracts/actions";
import type { ContractRow } from "../../types/api";

// Closes the brief §19 loop: after ComplianceFindingsPanel shows a
// violation, a user fixes it here, then presses "Run compliance
// validation" again (EvaluateComplianceButton) to revalidate. Only
// exposes the fields the Phase 3 rule engine actually evaluates.
export function ContractRemediationForm({ contract }: { contract: ContractRow }) {
  const [hasProbationExtension, setHasProbationExtension] = useState(
    contract.probationExtendedMonths !== null && contract.probationExtendedMonths > 0,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    const input: UpdateContractInput = {
      jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
      jobDescription: String(formData.get("jobDescription") ?? "") || undefined,
      workLocation: String(formData.get("workLocation") ?? "") || undefined,
      workingHoursPerWeek: formData.get("workingHoursPerWeek") ? Number(formData.get("workingHoursPerWeek")) : undefined,
      probationMonths: formData.get("probationMonths") ? Number(formData.get("probationMonths")) : undefined,
      probationExtendedMonths: hasProbationExtension && formData.get("probationExtendedMonths")
        ? Number(formData.get("probationExtendedMonths"))
        : 0,
      probationExtensionConsent: hasProbationExtension ? formData.get("probationExtensionConsent") === "on" : false,
      noticePeriodDays: formData.get("noticePeriodDays") ? Number(formData.get("noticePeriodDays")) : undefined,
    };

    startTransition(async () => {
      const result = await updateContractAction(contract.id, input);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Remediate</CardTitle>
        <CardDescription>Adjust the terms flagged above, then re-run compliance validation.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" defaultValue={contract.jobTitle ?? ""} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workLocation">Place of work</Label>
              <Input id="workLocation" name="workLocation" defaultValue={contract.workLocation ?? ""} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobDescription">Job description</Label>
            <Input id="jobDescription" name="jobDescription" defaultValue={contract.jobDescription ?? ""} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workingHoursPerWeek">Working hours per week</Label>
              <Input
                id="workingHoursPerWeek"
                name="workingHoursPerWeek"
                type="number"
                min={0}
                max={168}
                defaultValue={contract.workingHoursPerWeek ?? ""}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="noticePeriodDays">Notice period (days)</Label>
              <Input
                id="noticePeriodDays"
                name="noticePeriodDays"
                type="number"
                min={0}
                defaultValue={contract.noticePeriodDays ?? ""}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="probationMonths">Initial probation (months)</Label>
              <Input
                id="probationMonths"
                name="probationMonths"
                type="number"
                min={0}
                max={24}
                defaultValue={contract.probationMonths ?? ""}
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <Checkbox checked={hasProbationExtension} onCheckedChange={(v) => setHasProbationExtension(v === true)} />
            Extend probation
          </label>
          {hasProbationExtension && (
            <div className="grid grid-cols-2 gap-4 rounded-md border border-slate-200 p-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="probationExtendedMonths">Extension (months)</Label>
                <Input
                  id="probationExtendedMonths"
                  name="probationExtendedMonths"
                  type="number"
                  min={0}
                  max={24}
                  defaultValue={contract.probationExtendedMonths ?? ""}
                />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
                <Checkbox name="probationExtensionConsent" defaultChecked={contract.probationExtensionConsent === true} />
                Employee written consent obtained
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          {success && <p className="text-sm text-emerald-600">Saved. Re-run compliance validation to confirm.</p>}

          <Button type="submit" disabled={isPending} aria-busy={isPending} className="self-start">
            {isPending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
