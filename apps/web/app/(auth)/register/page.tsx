import Link from "next/link";
import { RegisterForm } from "../../../components/auth/RegisterForm";

export const metadata = { title: "Register — Nexa Workforce Solutions" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-4">
      <RegisterForm />
      <p className="text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
