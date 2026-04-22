"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { createApplicationAction } from "@/app/actions/applications";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";

export function NewApplicationForm() {
  const t = useTranslations("Applications");
  const [state, action, pending] = useActionState(createApplicationAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="company_name"
          label={t("companyName")}
          placeholder={t("companyNamePlaceholder")}
          hint={t("companyNameHint")}
        />
        <Field
          name="role_title"
          label={t("positionTitle")}
          placeholder={t("positionTitlePlaceholder")}
          hint={t("positionTitleHint")}
        />
      </div>

      <Field
        name="job_url"
        label={t("jobUrl")}
        type="url"
        placeholder={t("jobUrlPlaceholder")}
        hint={t("jobUrlHint")}
      />

      <TextareaField
        name="raw_job_text"
        label={t("jobDescription")}
        required
        rows={16}
        placeholder={t("jobDescriptionPlaceholder")}
        hint={t("jobDescriptionHint")}
        className="min-h-72 font-mono text-xs"
      />

      {state?.error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("analyzing") : t("analyzeWithAI")}
        </Button>
      </div>
    </form>
  );
}
