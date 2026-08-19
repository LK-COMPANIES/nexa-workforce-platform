import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">Nexa Workforce Solutions</h1>
          <p className="mt-1 text-sm text-slate-500">Enterprise workforce & payroll platform</p>
        </div>
        {children}
      </div>
    </div>
  );
}
