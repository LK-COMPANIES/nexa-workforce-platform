"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@nexa/ui";
import type { CreateContractInput } from "@nexa/validation";
import { createContractAction } from "../../lib/contracts/actions";
import type { ContractType } from "../../types/api";

const CONTRACT_TYPES: { value: ContractType; label: string }[] = [
  { value: "PERMANENT_EMPLOYMENT", label: "Permanent" },
  { value: "FIXED_TERM_EMPLOYMENT", label: "Fixed-Term" },
  { value: "CASUAL", label: "Casual" },
  { value: "OUTSOURCED_WORKFORCE", label: "Outsourced BPO" },
  { value: "TEMPORARY_STAFFING", label: "Temporary Staffing" },
  { value: "CONSULTING_ENGAGEMENT", label: "Consulting Engagement" },
  { value: "CLIENT_SERVICES_AGREEMENT", label: "Client Services Agreement" },
  { value: "INTERNSHIP", label: "Internship" },
];

// The structured-data-first workflow (brief §19): this form collects
// exactly the fields the Phase 3 compliance engine actually checks
// (jobTitle, workLocation, probation, notice period, etc.) — never a
// free-form text box standing in for the contract itself.
export function ContractGeneratorForm() {
  const [contractType, setContractType] = useState<ContractType>("PERMANENT_EMPLOYMENT");
  const [hasProbationExtension, setHasProbationExtension] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const requiresExpirationDate = contractType === "FIXED_TERM_EMPLOYMENT" || contractType === "CASUAL";

  function handleSubmit(formData: FormData) {
    setError(null);
    const input: CreateContractInput = {
      contractType,
      title: String(formData.get("title") ?? ""),
      effectiveDate: new Date(String(formData.get("effectiveDate"))),
      expirationDate: formData.get("expirationDate") ? new Date(String(formData.get("expirationDate"))) : undefined,
      baseCompensation: formData.get("baseCompensation") ? Number(formData.get("baseCompensation")) : undefined,
      currency: String(formData.get("currency") || "KES"),
      paymentInterval: (formData.get("paymentInterval") as CreateContractInput["paymentInterval"]) || undefined,
      jobTitle: String(formData.get("jobTitle") ?? "") || undefined,
      jobDescription: String(formData.get("jobDescription") ?? "") || undefined,
      workLocation: String(formData.get("workLocation") ?? "") || undefined,
      workingHoursPerWeek: formData.get("workingHoursPerWeek") ? Number(formData.get("workingHoursPerWeek")) : undefined,
      probationMonths: formData.get("probationMonths") ? Number(formData.get("probationMonths")) : undefined,
      probationExtendedMonths: hasProbationExtension && formData.get("probationExtendedMonths")
        ? Number(formData.get("probationExtendedMonths"))
        : undefined,
      probationExtensionConsent: hasProbationExtension ? formData.get("probationExtensionConsent") === "on" : undefined,
      noticePeriodDays: formData.get("noticePeriodDays") ? Number(formData.get("noticePeriodDays")) : undefined,
    };

    startTransition(async () => {
      const result = await createContractAction(input);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contract information</CardTitle>
        <CardDescription>Structured data required by the Employment Act 2007 compliance engine.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contractType">Contract type</Label>
            <Select value={contractType} onValueChange={(value) => setContractType(value as ContractType)}>
              <SelectTrigger id="contractType">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTRACT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="title">Contract title</Label>
            <Input id="title" name="title" required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="jobTitle">Job title</Label>
              <Input id="jobTitle" name="jobTitle" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workLocation">Place of work</Label>
              <Input id="workLocation" name="workLocation" required />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="jobDescription">Job description</Label>
            <Textarea id="jobDescription" name="jobDescription" rows={3} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="effectiveDate">Commencement date</Label>
              <Input id="effectiveDate" name="effectiveDate" type="date" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expirationDate">
                Expiration date {requiresExpirationDate && <span className="text-red-600">*</span>}
              </Label>
              <Input id="expirationDate" name="expirationDate" type="date" required={requiresExpirationDate} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="baseCompensation">Remuneration</Label>
              <Input id="baseCompensation" name="baseCompensation" type="number" min={0} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" name="currency" defaultValue="KES" maxLength={3} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paymentInterval">Payment interval</Label>
              <Select name="paymentInterval" defaultValue="MONTHLY">
                <SelectTrigger id="paymentInterval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="HOURLY">Hourly</SelectItem>
                  <SelectItem value="DAILY">Daily</SelectItem>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="workingHoursPerWeek">Working hours per week</Label>
            <Input id="workingHoursPerWeek" name="workingHoursPerWeek" type="number" min={0} max={168} required />
          </div>

          <Separator />
          <p className="text-sm font-medium text-slate-700">Probation (Employment Act s.42(2))</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="probationMonths">Initial probation (months)</Label>
              <Input id="probationMonths" name="probationMonths" type="number" min={0} max={24} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="noticePeriodDays">Notice period (days)</Label>
              <Input id="noticePeriodDays" name="noticePeriodDays" type="number" min={0} defaultValue={28} required />
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
                <Input id="probationExtendedMonths" name="probationExtendedMonths" type="number" min={0} max={24} />
              </div>
              <label className="mt-6 flex items-center gap-2 text-sm text-slate-700">
                <Checkbox name="probationExtensionConsent" />
                Employee written consent obtained
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button type="submit" disabled={isPending} aria-busy={isPending}>
            {isPending ? "Generating…" : "Generate contract"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
