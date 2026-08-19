import { ContractGeneratorForm } from "../../../../components/contracts/ContractGeneratorForm";

export const metadata = { title: "New contract — Nexa Workforce Solutions" };

export default function NewContractPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">New contract</h1>
        <p className="mt-1 text-sm text-slate-500">
          Generate a structured contract, then run compliance validation before activation.
        </p>
      </div>
      <div className="max-w-2xl">
        <ContractGeneratorForm />
      </div>
    </div>
  );
}
