"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Separator } from "@nexa/ui";
import { registerAction, type FormActionState } from "../../lib/auth/actions";

const initialState: FormActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Creating organization…" : "Create organization"}
    </Button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useFormState(registerAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register your organization</CardTitle>
        <CardDescription>This creates your organization and its first administrator account.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">Organization name</Label>
            <Input id="displayName" name="displayName" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legalName">Legal name</Label>
            <Input id="legalName" name="legalName" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="taxIdentifier">Tax identifier (optional)</Label>
            <Input id="taxIdentifier" name="taxIdentifier" placeholder="e.g. KRA PIN" />
          </div>

          <Separator className="my-1" />
          <p className="text-sm font-medium text-slate-700">Administrator account</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" name="firstName" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" name="lastName" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" minLength={12} required />
            <p className="text-xs text-slate-500">At least 12 characters.</p>
          </div>

          {state.error && (
            <p role="alert" className="text-sm text-red-600">
              {state.error}
            </p>
          )}
          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}
