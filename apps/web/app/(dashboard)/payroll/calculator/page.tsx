import { GrossToNetCalculator } from "../../../../components/payroll/GrossToNetCalculator";

export const metadata = { title: "Gross-to-Net Calculator — Nexa Workforce Solutions" };

export default function PayrollCalculatorPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Gross-to-Net Calculator</h1>
        <p className="mt-1 text-sm text-slate-500">
          A what-if tool. Calculations are performed by the same statutory payroll engine used for real payroll
          runs — nothing here is persisted.
        </p>
      </div>
      <GrossToNetCalculator />
    </div>
  );
}
