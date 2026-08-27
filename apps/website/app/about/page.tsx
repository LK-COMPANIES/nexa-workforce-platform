import type { Metadata } from "next";
import { ArrowRight, BookOpenCheck, Building2, Scale, ShieldCheck } from "lucide-react";
import { Container } from "../../components/Container";
import { LinkButton } from "../../components/Button";
import { Eyebrow, SectionHeading } from "../../components/SectionHeading";

export const metadata: Metadata = {
  title: "About",
  description:
    "Nexa Workforce Solutions builds payroll and workforce-compliance infrastructure for the Kenyan market — engineered for statutory accuracy first, everything else second.",
};

const PRINCIPLES = [
  {
    icon: Scale,
    title: "Statutory accuracy comes first",
    body: "PAYE, NSSF, SHIF, and Housing Levy figures aren't estimates — they're computed by a single, tested calculation engine against versioned, dated statutory rates, and every citation is traceable back to its source.",
  },
  {
    icon: ShieldCheck,
    title: "Security is architecture, not a feature",
    body: "Multi-tenant isolation is enforced by the database itself. Permissions are re-checked live, every request. These aren't marketing claims — they're the actual mechanism the platform runs on.",
  },
  {
    icon: BookOpenCheck,
    title: "Honesty about what's verified, and what isn't",
    body: "Where a statutory rate or legal citation hasn't yet been checked against a primary government source, the platform says so, plainly — rather than presenting a guess with false confidence.",
  },
  {
    icon: Building2,
    title: "Built for Kenya, built to grow",
    body: "The platform is designed around Kenya's specific statutory environment first, with an architecture that can extend to additional jurisdictions as the business does.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-28">
        <Container className="max-w-3xl">
          <Eyebrow>About Nexa</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Payroll infrastructure that takes Kenyan statutory law seriously
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Nexa Workforce Solutions Ltd builds workforce and payroll infrastructure for organizations
            operating in Kenya — designed around the country&apos;s specific statutory requirements
            rather than adapted from a generic, one-size-fits-all payroll product.
          </p>
        </Container>
      </section>

      <section className="py-20 sm:py-28">
        <Container className="max-w-3xl">
          <SectionHeading
            title="Why we exist"
            description="Payroll and employment compliance in Kenya involve real complexity: four statutory instruments with their own bands, tiers, and effective dates, and an Employment Act with specific, checkable requirements for every contract. Getting it wrong isn't cosmetic — it's a real liability for employers and a real harm to employees. Nexa exists to make getting it right the default, not the exception."
          />
        </Container>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-20 sm:py-28">
        <Container>
          <SectionHeading eyebrow="How we build" title="The principles behind the platform" align="center" />
          <div className="mt-16 grid grid-cols-1 gap-10 sm:grid-cols-2">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <principle.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-slate-900">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{principle.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-28">
        <Container className="flex flex-col items-center text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Want to see how it works for your organization?
          </h2>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            We&apos;re glad to walk you through the platform, in detail, on your own scenario.
          </p>
          <div className="mt-8">
            <LinkButton href="/contact" size="lg">
              Get in touch
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
