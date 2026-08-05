"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<FormState, FormData>(
    loginAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label={t("email")} name="email" type="email" required autoComplete="email" />
      <Field
        label={t("password")}
        name="password"
        type="password"
        required
        autoComplete="current-password"
      />
      {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? t("submitting") : t("submit")}
      </Button>
    </form>
  );
}
