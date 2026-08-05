"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { startDemoAction, type FormState } from "@/lib/auth/actions";

export function StartDemoButton({
  className = "btn btn-secondary",
  showError = false,
}: {
  className?: string;
  showError?: boolean;
}) {
  const t = useTranslations("Demo");
  const [state, action, pending] = useActionState<FormState, FormData>(
    startDemoAction,
    undefined,
  );

  return (
    <form action={action} className={showError ? "flex flex-col items-center gap-2" : undefined}>
      <button type="submit" className={className} disabled={pending}>
        {pending ? t("starting") : t("tryButton")}
      </button>
      {showError && state?.error ? (
        <p className="max-w-sm text-center text-xs text-danger">{state.error}</p>
      ) : null}
    </form>
  );
}
