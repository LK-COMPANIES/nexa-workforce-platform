import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "./Container";

const FOOTER_LINKS = {
  Platform: [
    { href: "/platform#payroll", label: "Statutory Payroll" },
    { href: "/platform#contracts", label: "Contracts & Compliance" },
    { href: "/platform#ai", label: "AI-Assisted Review" },
    { href: "/platform#security", label: "Security & Multi-Tenancy" },
  ],
  Company: [
    { href: "/about", label: "About Nexa" },
    { href: "/contact", label: "Contact & Demo Requests" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <Container className="py-16">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-[2fr_1fr_1fr]">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Workforce and payroll infrastructure built for Kenya&apos;s statutory environment —
              PAYE, NSSF, SHIF, and the Affordable Housing Levy, calculated correctly and
              reproducibly, with Employment Act 2007 compliance built into every contract.
            </p>
            <p className="mt-4 text-sm text-slate-500">Built for the Kenyan market. Nairobi, Kenya.</p>
          </div>

          {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
            <div key={heading}>
              <h3 className="text-sm font-semibold text-slate-900">{heading}</h3>
              <ul className="mt-4 space-y-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-sm text-slate-600 hover:text-brand-700">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-slate-200 pt-8 sm:flex-row sm:items-center">
          <p className="text-sm text-slate-500">
            &copy; {new Date().getFullYear()} Nexa Workforce Solutions Ltd. All rights reserved.
          </p>
        </div>
      </Container>
    </footer>
  );
}
