"use client";

import { useFormState, useFormStatus } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { submitContactForm, type ContactFormState } from "../lib/contact-action";
import { Button } from "./Button";

const initialState: ContactFormState = { status: "idle" };

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="mt-1.5 text-sm text-red-600">
      {messages[0]}
    </p>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={pending} aria-busy={pending}>
      {pending ? "Sending…" : "Send message"}
    </Button>
  );
}

export function ContactForm() {
  const [state, formAction] = useFormState(submitContactForm, initialState);

  if (state.status === "success") {
    return (
      <div className="rounded-2xl border border-accent-200 bg-accent-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-accent-600" aria-hidden />
        <h3 className="mt-4 font-display text-lg font-semibold text-slate-900">Thanks — message received</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          We&apos;ve recorded your request and will follow up with you shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-800">
            Full name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            className="mt-1.5 block w-full rounded-lg border-0 px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600"
          />
          <FieldError messages={state.fieldErrors?.name} />
        </div>
        <div>
          <label htmlFor="organization" className="block text-sm font-medium text-slate-800">
            Organization
          </label>
          <input
            id="organization"
            name="organization"
            type="text"
            autoComplete="organization"
            required
            className="mt-1.5 block w-full rounded-lg border-0 px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600"
          />
          <FieldError messages={state.fieldErrors?.organization} />
        </div>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-800">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-1.5 block w-full rounded-lg border-0 px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600"
        />
        <FieldError messages={state.fieldErrors?.email} />
      </div>

      <div>
        <label htmlFor="message" className="block text-sm font-medium text-slate-800">
          What are you looking to solve?
        </label>
        <textarea
          id="message"
          name="message"
          rows={5}
          required
          placeholder="Tell us about your organization's payroll or compliance challenge."
          className="mt-1.5 block w-full rounded-lg border-0 px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-brand-600"
        />
        <FieldError messages={state.fieldErrors?.message} />
      </div>

      {state.status === "error" && state.error && !state.fieldErrors && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}
