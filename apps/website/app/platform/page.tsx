import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Fingerprint,
  GitBranch,
  History,
  KeyRound,
  Lock,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCog,
} from "lucide-react";
import { Container } from "../../components/Container";
import { LinkButton } from "../../components/Button";
import { Eyebrow, SectionHeading } from "../../components/SectionHeading";

export const metadata: Metadata = {
  title: "Platform",
  description:
    "A deep dive into Nexa Workforce Solutions: the statutory payroll engine, contract & compliance engine, AI-assisted review, and the multi-tenant security architecture underneath all of it.",
};

function Point({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent-600" aria-hidden />
      <span className="text-sm leading-6 text-slate-600">{children}</span>
    </li>
  );
}

export default function PlatformPage() {
  return (
    <>
      <section className="border-b border-slate-200 bg-slate-50 py-20 sm:py-28">
        <Container className="max-w-3xl text-center">
          <Eyebrow>The platform</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            One platform, four disciplines
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Statutory payroll, employment contract compliance, AI-assisted review, and the security
            architecture that ties them together without ever letting one discipline quietly become
            authoritative over another.
          </p>
        </Container>
      </section>

      {/* Payroll */}
      <section id="payroll" className="scroll-mt-20 py-20 sm:py-28">
        <Container className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ScrollText className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold text-slate-900">Statutory Payroll Engine</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              A dedicated calculation engine — not a spreadsheet formula, not logic scattered across the
              app — computes PAYE, NSSF, SHIF, and the Affordable Housing Levy from the same, single
              source of truth every time.
            </p>
            <ul className="mt-8 space-y-4">
              <Point>PAYE with the full progressive band structure and personal relief applied correctly.</Point>
              <Point>NSSF&apos;s two-tier contribution structure (Tier I and Tier II), calculated to the cap.</Point>
              <Point>SHIF and the Affordable Housing Levy, calculated per the current statutory rate.</Point>
              <Point>Every monetary figure computed with exact decimal arithmetic — no floating-point drift.</Point>
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <History className="h-4 w-4 text-brand-600" aria-hidden />
              Statutory rates are versioned, not hard-coded
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Every statutory rate is stored with an effective date and a source citation — never a
              constant buried in application code. When a rate changes, it&apos;s a new version, not a
              rewrite of history.
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <GitBranch className="h-4 w-4 text-brand-600" aria-hidden />
              Historical payroll stays reproducible
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A payroll run permanently records exactly which statutory rate version calculated it. Run
              your March payroll report again in December — it reproduces the same figures, calculated
              against the rates that actually applied in March.
            </p>
          </div>
        </Container>
      </section>

      {/* Contracts & Compliance */}
      <section id="contracts" className="scroll-mt-20 border-t border-slate-200 bg-slate-50 py-20 sm:py-28">
        <Container className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
          <div className="order-2 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm lg:order-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldAlert className="h-4 w-4 text-brand-600" aria-hidden />
              Deterministic, not discretionary
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Contract compliance is checked by rules, not vibes: probation duration limits (Employment
              Act s.42(2)), minimum notice periods (s.35), written-particulars requirements, and
              casual-to-permanent conversion thresholds (s.37) — each one a specific, citable rule, not a
              general sense that something &quot;looks fine.&quot;
            </p>
            <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Building2 className="h-4 w-4 text-brand-600" aria-hidden />
              Built for outsourced workforce arrangements too
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Outsourced/BPO contracts get honest treatment: where determining the true employer of
              record needs human judgment, the platform flags it for review rather than guessing.
            </p>
          </div>
          <div className="order-1 lg:order-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold text-slate-900">
              Contract &amp; Compliance Engine
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              Generate structured employment contracts — Permanent, Fixed-Term, Casual, or Outsourced
              Workforce — and get real-time compliance findings against Employment Act 2007, with clear
              severity levels and a specific remediation path, not a wall of legal text.
            </p>
            <ul className="mt-8 space-y-4">
              <Point>Structured contract data, not free-form text pretending to be a compliance record.</Point>
              <Point>Findings scored PASS, WARNING, FAIL, or REQUIRES HUMAN REVIEW — never a false PASS.</Point>
              <Point>Every evaluation is a permanent, append-only record — compliance history is evidence.</Point>
            </ul>
          </div>
        </Container>
      </section>

      {/* AI-Assisted Review */}
      <section id="ai" className="scroll-mt-20 py-20 sm:py-28">
        <Container className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-start">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <Bot className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="mt-5 font-display text-3xl font-semibold text-slate-900">AI-Assisted Review</h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              An AI layer gives your team a second opinion — on contract drafting quality, and on the
              quality of outsourced-workforce customer interactions — without ever being handed
              authority over statutory arithmetic or legal compliance determinations.
            </p>
            <ul className="mt-8 space-y-4">
              <Point>Contract audit: drafting-quality feedback, structurally separate from statutory findings.</Point>
              <Point>BPO quality review: AI assessment of real interaction transcripts against service terms.</Point>
              <Point>Every AI request and outcome is logged — a genuine, queryable governance trail.</Point>
              <Point>Structured, schema-validated output only — never free-text the product has to trust blindly.</Point>
            </ul>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-accent-200 bg-accent-50/40 p-8">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-700" aria-hidden />
              <span className="text-sm font-semibold text-accent-800">The one rule that never bends</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-700">
              The AI layer advises. It does not decide. A deterministic compliance result is never
              silently overwritten by an AI opinion — the two are computed independently, stored
              independently, and shown to your team clearly labeled as what they are.
            </p>
          </div>
        </Container>
      </section>

      {/* Security */}
      <section id="security" className="scroll-mt-20 border-t border-slate-200 bg-brand-950 py-20 text-white sm:py-28">
        <Container>
          <SectionHeading
            eyebrow="Security & multi-tenancy"
            title={<span className="text-white">Architecture, not a checkbox</span>}
            description={
              <span className="text-brand-200">
                Every tenant&apos;s data is isolated at the database layer — not just trusted to
                application code that could someday have a bug.
              </span>
            }
          />
          <div className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Lock className="h-6 w-6 text-accent-400" aria-hidden />
              <h3 className="mt-4 font-display text-base font-semibold text-white">Row-Level Security</h3>
              <p className="mt-2 text-sm leading-6 text-brand-200">
                PostgreSQL enforces tenant isolation itself — the real backstop, not just an
                application-layer promise.
              </p>
            </div>
            <div>
              <KeyRound className="h-6 w-6 text-accent-400" aria-hidden />
              <h3 className="mt-4 font-display text-base font-semibold text-white">Live permission checks</h3>
              <p className="mt-2 text-sm leading-6 text-brand-200">
                Access tokens carry no embedded permissions — every request re-verifies your actual,
                current role against the database.
              </p>
            </div>
            <div>
              <Fingerprint className="h-6 w-6 text-accent-400" aria-hidden />
              <h3 className="mt-4 font-display text-base font-semibold text-white">Argon2id password hashing</h3>
              <p className="mt-2 text-sm leading-6 text-brand-200">
                Modern, memory-hard password hashing, with session and refresh-token rotation and reuse
                detection.
              </p>
            </div>
            <div>
              <UserCog className="h-6 w-6 text-accent-400" aria-hidden />
              <h3 className="mt-4 font-display text-base font-semibold text-white">Full audit trail</h3>
              <p className="mt-2 text-sm leading-6 text-brand-200">
                Authentication events, permission decisions, and AI activity are all logged for
                accountability — not just kept in an ephemeral console.
              </p>
            </div>
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-28">
        <Container className="flex flex-col items-center text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Ready to see the whole platform in action?
          </h2>
          <p className="mt-4 max-w-xl text-lg text-slate-600">
            We&apos;ll walk through payroll, contracts, compliance, and the AI layer together — with real
            Kenyan statutory data, on your own scenario.
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
