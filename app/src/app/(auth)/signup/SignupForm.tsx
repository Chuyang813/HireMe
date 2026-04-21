"use client";

import { useActionState } from "react";
import { signupAction, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    signupAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label="Name" name="displayName" required autoComplete="name" />
      <Field label="Email" name="email" type="email" required autoComplete="email" />
      <Field
        label="Password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters."
      />
      {state?.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
