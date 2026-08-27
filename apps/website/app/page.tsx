import {
  ArrowRight,
  Bot,
  FileCheck2,
  KeyRound,
  Layers,
  Lock,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Container } from "../components/Container";
import { LinkButton } from "../components/Button";
import { Eyebrow, SectionHeading } from "../components/SectionHeading";
import { FeatureCard } from "../components/FeatureCard";
import { HeroVisual } from "../components/HeroVisual";

const CORE_FEATURES = [
  {
    icon: ScrollText,
    title: "Statutory Payroll Engine",
    body: "PAYE, NSSF, SHIF, and the Affordable Housing Levy — calculated by a dedicated, pure calculation engine with no floating-point drift, and no re-implementation scattered across the app.",
  },
  {
    icon: FileCheck2,
    title: "Employment Act 2007 Compliance",
    body: "Every contract is checked against deterministic rules — probation limits, notice periods, written-particulars requirements, casual-to-permanent conversion — before it becomes a problem.",
  },
  {
    icon: Bot,
    title: "AI-Assisted Contract Review",
    body: "An AI second opinion on contract drafting quality, clearly labeled and structurally separated from statutory determinations — it advises, it never overrides the deterministic engine.",
  },
  {
    icon: Lock,
    title: "Tenant Isolation, Enforced by the Database",
    body: "Multi-tenancy isn't an application-layer promise here — PostgreSQL Row-Level Security enforces it at the database itself, the backstop even if a query ever forgot to filter.",
  },
  {
    icon: KeyRound,
    title: "Role-Based Access Control",
    body: "Permissions are re-verified from the database on every request, never trusted from a token — a revoked role takes effect immediately, not at next login.",
  },
  {
    icon: ShieldCheck,
    title: "A Complete Audit Trail",
    body: "Authentication events, permission decisions, and every AI interaction are logged — so 'what happened, and why' is always answerable, not just hoped for.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Onboard your organization",
    body: "Register your organization, invite your team, and assign roles — HR, payroll processing, and approval are separated by design.",
  },
  {
    number: "02",
    title: "Build compliant contracts",
    body: "Generate structured employment contracts and get instant, deterministic Employment Act 2007 compliance feedback — not a document you hope is right.",
  },
  {
    number: "03",
    title: "Run statutory payroll",
    body: "Calculate PAYE, NSSF, SHIF, and Housing Levy correctly, with historical runs reproducible against the exact statutory rates that applied at the time.",
  },
  {
    number: "04",
    title: "Review with AI, decide with certainty",
    body: "Get AI-assisted insight on contract quality and BPO interaction quality — always clearly separate from, and never a substitute for, the statutory determination.",
  },
];

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-white pt-16 sm:pt-24">
        <div
          className="absolute inset-0 -z-10 bg-grid-slate bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black_10%,transparent_70%)]"
          aria-hidden
        />
        <Container className="grid grid-cols-1 items-center gap-16 pb-20 lg:grid-cols-2 lg:pb-28">
          <div>
            <Eyebrow>Built for Kenya&apos;s statutory environment</Eyebrow>
            <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
              Payroll and workforce compliance,
              <span className="text-brand-600"> computed correctly</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              Nexa Workforce Solutions is the payroll and compliance infrastructure built specifically
              for Kenya&apos;s statutory requirements — PAYE, NSSF, SHIF, the Affordable Housing Levy, and
              Employment Act 2007 contract compliance — on a secure, multi-tenant platform with an
              AI-assisted second opinion built in.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <LinkButton href="/contact" size="lg">
                Request a demo
                <ArrowRight className="h-4 w-4" aria-hidden />
              </LinkButton>
              <LinkButton href="/platform" variant="secondary" size="lg">
                Explore the platform
              </LinkButton>
            </div>
          </div>
          <HeroVisual />
        </Container>
      </section>

      {/* Why it matters */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <Container>
          <SectionHeading
            eyebrow="Why it matters"
            title="Kenyan payroll compliance doesn't forgive shortcuts"
            description="Four statutory instruments, each with its own bands, tiers, and effective dates that change over time. Get any one of them wrong and it isn't a cosmetic bug — it's a real liability to your business and your employees."
          />
          <div className="mt-16 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2">
            <div>
              <h3 className="font-display text-lg font-semibold text-slate-900">The old way</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>Spreadsheet formulas that drift from the actual statutory bands over time.</li>
                <li>Contract templates nobody has re-checked against the Employment Act since they were written.</li>
                <li>No record of which statutory rates applied when a specific payroll run was calculated.</li>
                <li>Access control that&apos;s a shared login, not a real permission system.</li>
              </ul>
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold text-brand-700">The Nexa way</h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-600">
                <li>A single, tested calculation engine — every statutory rate versioned, with an effective date.</li>
                <li>Every contract checked against deterministic Employment Act 2007 rules before it&apos;s finalized.</li>
                <li>Every historical payroll run reproducible against the exact rates that applied at the time.</li>
                <li>Role-based access, enforced at the database, re-verified on every single request.</li>
              </ul>
            </div>
          </div>
        </Container>
      </section>

      {/* Feature grid */}
      <section className="py-20 sm:py-28">
        <Container>
          <SectionHeading
            eyebrow="The platform"
            title="Everything statutory payroll and compliance needs, in one place"
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CORE_FEATURES.map((feature) => (
              <FeatureCard key={feature.title} icon={feature.icon} title={feature.title}>
                {feature.body}
              </FeatureCard>
            ))}
          </div>
        </Container>
      </section>

      {/* How it works */}
      <section className="bg-brand-950 py-20 text-white sm:py-28">
        <Container>
          <SectionHeading
            eyebrow="How it works"
            title={<span className="text-white">From onboarding to payroll, in four deliberate steps</span>}
            align="center"
          />
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step) => (
              <div key={step.number}>
                <span className="font-display text-3xl font-bold text-brand-400">{step.number}</span>
                <h3 className="mt-3 font-display text-lg font-semibold text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-brand-200">{step.body}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* Security + AI distinction callout */}
      <section className="py-20 sm:py-28">
        <Container className="grid grid-cols-1 gap-12 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Layers className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-slate-900">
              Security isn&apos;t a feature bullet — it&apos;s the architecture
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Every tenant&apos;s data is isolated by PostgreSQL Row-Level Security, not just application
              code that could have a bug. Passwords are hashed with Argon2id. Access tokens carry no
              embedded permissions — every request re-checks your actual, current role against the
              database. It&apos;s the backstop that holds even if something upstream goes wrong.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 p-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <Sparkles className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="mt-4 font-display text-xl font-semibold text-slate-900">
              AI that advises — statutory determinations stay deterministic
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Nexa&apos;s AI agents give you a second opinion on contract drafting quality and BPO
              interaction quality. They are never the authority on statutory arithmetic or legal
              compliance — that stays with the deterministic rule engine, always, and the two are never
              visually or structurally confused in the product.
            </p>
          </div>
        </Container>
      </section>

      {/* CTA */}
      <section className="bg-slate-50 py-20 sm:py-28">
        <Container className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-sm ring-1 ring-slate-200 sm:px-16">
          <Users className="h-10 w-10 text-brand-600" aria-hidden />
          <h2 className="mt-6 font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            See it running on your own scenario
          </h2>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            Tell us about your organization and we&apos;ll walk you through the platform — payroll,
            contracts, compliance, and the AI layer — with real Kenyan statutory data.
          </p>
          <div className="mt-8">
            <LinkButton href="/contact" size="lg">
              Request a demo
              <ArrowRight className="h-4 w-4" aria-hidden />
            </LinkButton>
          </div>
        </Container>
      </section>
    </>
  );
}
