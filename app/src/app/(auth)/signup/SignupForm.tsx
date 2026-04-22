"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { signupAction, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function SignupForm() {
  const t = useTranslations("Signup");
  const [state, action, pending] = useActionState<FormState, FormData>(
    signupAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label={t("name")} name="displayName" required autoComplete="name" />
      <Field label={t("email")} name="email" type="email" required autoComplete="email" />
      <Field
        label={t("password")}
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        hint={t("passwordHint")}
      />
      {state?.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
