import type { Metadata } from "next";
import { CalendarClock, MessageSquare, Sparkles } from "lucide-react";
import { Container } from "../../components/Container";
import { Eyebrow } from "../../components/SectionHeading";
import { ContactForm } from "../../components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Tell us about your organization and request a demo of Nexa Workforce Solutions.",
};

const EXPECTATIONS = [
  {
    icon: MessageSquare,
    title: "Tell us what you're solving for",
    body: "A few lines about your organization and your payroll or compliance challenge is all we need to start.",
  },
  {
    icon: CalendarClock,
    title: "We'll follow up to schedule time",
    body: "We'll reach out to arrange a walkthrough at a time that works for your team.",
  },
  {
    icon: Sparkles,
    title: "See it on real Kenyan statutory data",
    body: "The demo runs on the actual PAYE, NSSF, SHIF, and Housing Levy calculations — not a simplified mockup.",
  },
];

export default function ContactPage() {
  return (
    <section className="py-20 sm:py-28">
      <Container className="grid grid-cols-1 gap-16 lg:grid-cols-2">
        <div>
          <Eyebrow>Get in touch</Eyebrow>
          <h1 className="mt-6 font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Let&apos;s talk about your payroll and compliance needs
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            Whether you&apos;re evaluating a new payroll platform or want to see how Employment Act 2007
            compliance checking works in practice, tell us a bit about your organization and we&apos;ll
            take it from there.
          </p>

          <div className="mt-12 space-y-8">
            {EXPECTATIONS.map((item) => (
              <div key={item.title} className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <item.icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <ContactForm />
        </div>
      </Container>
    </section>
  );
}
