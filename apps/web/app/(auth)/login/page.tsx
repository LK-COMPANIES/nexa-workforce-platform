import Link from "next/link";
import { LoginForm } from "../../../components/auth/LoginForm";

export const metadata = { title: "Sign in — Nexa Workforce Solutions" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-4">
      <LoginForm />
      <p className="text-center text-sm text-slate-500">
        New organization?{" "}
        <Link href="/register" className="font-medium text-slate-900 underline underline-offset-4">
          Register your organization
        </Link>
      </p>
    </div>
  );
}
