"use client";

import { useState, useTransition } from "react";
import type { PayrollCalculationResult } from "@nexa/payroll-engine";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from "@nexa/ui";
import { calculatePayrollPreviewAction } from "../../lib/payroll/actions";

interface BenefitRow {
  label: string;
  amount: string;
  taxable: boolean;
}

interface DeductionRow {
  label: string;
  amount: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function money(value: number, currency: string): string {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

// Calls the backend engine via a Server Action (brief §14: never
// reimplement PAYE/NSSF/SHIF/Housing Levy in React) — every figure shown
// below is exactly what packages/payroll-engine returned, unmodified.
export function GrossToNetCalculator() {
  const [cashGrossPay, setCashGrossPay] = useState("100000");
  const [periodStart, setPeriodStart] = useState(firstOfMonth());
  const [periodEnd, setPeriodEnd] = useState(today());
  const [benefits, setBenefits] = useState<BenefitRow[]>([]);
  const [deductions, setDeductions] = useState<DeductionRow[]>([]);
  const [result, setResult] = useState<PayrollCalculationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCalculate() {
    setError(null);
    startTransition(async () => {
      const response = await calculatePayrollPreviewAction({
        cashGrossPay: Number(cashGrossPay) || 0,
        nonCashBenefits: benefits
          .filter((b) => b.label.trim())
          .map((b) => ({ label: b.label, amount: Number(b.amount) || 0, taxable: b.taxable })),
        allowableDeductions: deductions
          .filter((d) => d.label.trim())
          .map((d) => ({
            type: "OTHER_ALLOWABLE_STATUTORY" as const,
            amount: Number(d.amount) || 0,
            taxTreatment: "PRE_TAX" as const,
            employeeImpact: true,
            employerImpact: false,
            description: d.label,
          })),
        otherDeductions: [],
        payrollPeriodStart: new Date(periodStart),
        payrollPeriodEnd: new Date(periodEnd),
        currency: "KES",
      });
      if (response.error) {
        setError(response.error);
        setResult(null);
      } else if (response.result) {
        setResult(response.result);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Inputs</CardTitle>
          <CardDescription>Values are sent to the backend payroll engine for calculation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodStart">Period start</Label>
              <Input id="periodStart" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="periodEnd">Period end</Label>
              <Input id="periodEnd" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cashGrossPay">Gross cash salary (KES)</Label>
            <Input
              id="cashGrossPay"
              type="number"
              min={0}
              value={cashGrossPay}
              onChange={(e) => setCashGrossPay(e.target.value)}
            />
          </div>

          <Separator />
          <div className="flex items-center justify-between">
            <Label>Non-cash benefits</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBenefits((prev) => [...prev, { label: "", amount: "0", taxable: true }])}
            >
              Add benefit
            </Button>
          </div>
          {benefits.map((benefit, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor={`benefit-label-${index}`} className="sr-only">
                  Benefit label
                </Label>
                <Input
                  id={`benefit-label-${index}`}
                  placeholder="e.g. Company car"
                  value={benefit.label}
                  onChange={(e) =>
                    setBenefits((prev) => prev.map((b, i) => (i === index ? { ...b, label: e.target.value } : b)))
                  }
                />
              </div>
              <div className="w-32">
                <Label htmlFor={`benefit-amount-${index}`} className="sr-only">
                  Amount
                </Label>
                <Input
                  id={`benefit-amount-${index}`}
                  type="number"
                  min={0}
                  value={benefit.amount}
                  onChange={(e) =>
                    setBenefits((prev) => prev.map((b, i) => (i === index ? { ...b, amount: e.target.value } : b)))
                  }
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={benefit.taxable}
                  onChange={(e) =>
                    setBenefits((prev) =>
                      prev.map((b, i) => (i === index ? { ...b, taxable: e.target.checked } : b)),
                    )
                  }
                />
                Taxable
              </label>
            </div>
          ))}

          <Separator />
          <div className="flex items-center justify-between">
            <Label>Allowable deductions (pre-tax)</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeductions((prev) => [...prev, { label: "", amount: "0" }])}
            >
              Add deduction
            </Button>
          </div>
          {deductions.map((deduction, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor={`deduction-label-${index}`} className="sr-only">
                  Deduction label
                </Label>
                <Input
                  id={`deduction-label-${index}`}
                  placeholder="e.g. Pension contribution"
                  value={deduction.label}
                  onChange={(e) =>
                    setDeductions((prev) => prev.map((d, i) => (i === index ? { ...d, label: e.target.value } : d)))
                  }
                />
              </div>
              <div className="w-32">
                <Label htmlFor={`deduction-amount-${index}`} className="sr-only">
                  Amount
                </Label>
                <Input
                  id={`deduction-amount-${index}`}
                  type="number"
                  min={0}
                  value={deduction.amount}
                  onChange={(e) =>
                    setDeductions((prev) => prev.map((d, i) => (i === index ? { ...d, amount: e.target.value } : d)))
                  }
                />
              </div>
            </div>
          ))}

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <Button onClick={handleCalculate} disabled={isPending} aria-busy={isPending}>
            {isPending ? "Calculating…" : "Calculate"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
          <CardDescription>Computed by the backend statutory payroll engine — not this browser.</CardDescription>
        </CardHeader>
        <CardContent>
          {!result ? (
            <p className="text-sm text-slate-400">Enter inputs and calculate to see a breakdown.</p>
          ) : (
            <dl className="flex flex-col gap-2 text-sm">
              {(
                [
                  ["Gross pay", result.grossPay],
                  ["Taxable benefits", result.taxableBenefits],
                  ["NSSF (employee)", result.nssfEmployeeTotal],
                  ["SHIF", result.shifEmployee],
                  ["Housing Levy (employee)", result.housingLevyEmployee],
                  ["Allowable deductions", result.allowableDeductionsTotal],
                  ["Taxable pay", result.taxablePay],
                  ["PAYE before relief", result.payeBeforeRelief],
                  ["Personal relief", result.personalRelief],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 py-1">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="tabular-nums text-slate-900">{money(value, result.currency)}</dd>
                </div>
              ))}
              <div className="flex justify-between border-b border-slate-100 py-1 font-semibold">
                <dt>Final PAYE</dt>
                <dd className="tabular-nums">{money(result.paye, result.currency)}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-100 py-1 text-base font-bold text-slate-900">
                <dt>Net pay</dt>
                <dd className="tabular-nums">{money(result.netPay, result.currency)}</dd>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between py-1">
                <dt className="text-slate-500">Employer contributions</dt>
                <dd className="tabular-nums text-slate-900">{money(result.employerStatutoryCost, result.currency)}</dd>
              </div>
              <div className="flex justify-between py-1 font-semibold">
                <dt>Total employment cost</dt>
                <dd className="tabular-nums">{money(result.totalEmploymentCost, result.currency)}</dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
