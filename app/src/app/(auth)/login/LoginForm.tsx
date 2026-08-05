"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, startDemoAction, type FormState } from "@/lib/auth/actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("Login");
  const [state, action, pending] = useActionState<FormState, FormData>(
    loginAction,
    undefined,
  );
  const [demoState, demoAction, demoPending] = useActionState<FormState, FormData>(
    startDemoAction,
    undefined,
  );
  return (
    <div className="flex flex-col gap-5">
      <form id="login-form" action={action} className="flex flex-col gap-5">
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
      </form>

      <div className="grid grid-cols-2 gap-3">
        <Button form="login-form" type="submit" disabled={pending || demoPending}>
          {pending ? t("submitting") : t("submit")}
        </Button>
        <form action={demoAction}>
          <Button type="submit" variant="outline" className="w-full" disabled={pending || demoPending}>
            {demoPending ? t("demoSubmitting") : t("demoSubmit")}
          </Button>
        </form>
      </div>

      {demoState?.error ? <p className="text-sm text-danger">{demoState.error}</p> : null}
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
        {t("demoHint")}
      </p>
    </div>
  );
}
