"use server";

import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(1, "Please tell us your name.").max(200),
  email: z.string().email("Please enter a valid work email."),
  organization: z.string().min(1, "Please tell us your organization.").max(200),
  message: z.string().min(1, "Please tell us a little about what you're looking to solve.").max(4000),
});

export interface ContactFormState {
  status: "idle" | "success" | "error";
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

// IMPORTANT / not yet wired to real delivery: this validates and records
// the submission (structured log — matching the rest of this platform's
// "no scattered fetch/side effects" discipline), but no email or CRM
// provider is configured anywhere in this project. Before this goes live,
// wire a real destination here (e.g. Resend, SendGrid, or a CRM's forms
// API) using that provider's own API key — do not present this as
// delivering to a monitored inbox until that's actually true.
export async function submitContactForm(
  _prevState: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    organization: formData.get("organization"),
    message: formData.get("message"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      error: "Please check the form for errors.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  console.log(
    JSON.stringify({
      event: "contact_form_submission",
      timestamp: new Date().toISOString(),
      name: parsed.data.name,
      email: parsed.data.email,
      organization: parsed.data.organization,
      messageLength: parsed.data.message.length,
    }),
  );

  return { status: "success" };
}
