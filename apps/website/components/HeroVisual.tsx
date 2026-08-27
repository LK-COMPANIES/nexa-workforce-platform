import { CheckCircle2, ShieldCheck } from "lucide-react";

const STATUTORY_ROWS = [
  { label: "PAYE", note: "5 progressive bands + relief" },
  { label: "NSSF", note: "Tier I & Tier II" },
  { label: "SHIF", note: "Statutory rate applied" },
  { label: "Housing Levy", note: "Employee & employer" },
];

// An illustrative product mockup, not a screenshot of a real customer's
// data — every label here is a statutory line item name (a fact about
// Kenyan payroll law, not a claim about any specific employer or amount).
export function HeroVisual() {
  return (
    <div className="relative">
      <div
        className="absolute -inset-x-8 -top-8 -bottom-8 -z-10 rounded-[2.5rem] bg-gradient-to-br from-brand-100 via-white to-accent-100 blur-2xl"
        aria-hidden
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 text-xs font-medium text-slate-400">Payroll Run — Preview</span>
        </div>
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Statutory calculation</p>
              <p className="mt-1 font-display text-base font-semibold text-slate-900">Net pay, computed correctly</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 ring-1 ring-inset ring-accent-200">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Compliant
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {STATUTORY_ROWS.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-2.5"
              >
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-accent-600" aria-hidden />
                  <span className="text-sm font-medium text-slate-800">{row.label}</span>
                </div>
                <span className="text-xs text-slate-500">{row.note}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between rounded-lg bg-brand-950 px-3.5 py-3">
            <span className="text-sm font-medium text-brand-100">Employment Act 2007 review</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white">
              Deterministic + AI-assisted
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
