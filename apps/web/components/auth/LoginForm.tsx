"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "@nexa/ui";
import { loginAction, type FormActionState } from "../../lib/auth/actions";

const initialState: FormActionState = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
      {pending ? "Signing in…" : "Sign in"}
    </Button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initialState);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Enter your credentials and organization to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
            {state.fieldErrors?.email && (
              <p className="text-sm text-red-600">{state.fieldErrors.email[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" autoComplete="current-password" required />
            {state.fieldErrors?.password && (
              <p className="text-sm text-red-600">{state.fieldErrors.password[0]}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="organizationId">Organization ID</Label>
            <Input id="organizationId" name="organizationId" type="text" placeholder="Provided by your administrator" required />
            {state.fieldErrors?.organizationId && (
              <p className="text-sm text-red-600">{state.fieldErrors.organizationId[0]}</p>
            )}
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
