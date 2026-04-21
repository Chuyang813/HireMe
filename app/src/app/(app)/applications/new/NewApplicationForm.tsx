"use client";

import { useActionState } from "react";
import { createApplicationAction } from "@/app/actions/applications";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";

export function NewApplicationForm() {
  const [state, action, pending] = useActionState(createApplicationAction, undefined);

  return (
    <form action={action} className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="company_name"
          label="Company name"
          placeholder="Acme Corp"
          hint="Leave blank to auto-detect from job description"
        />
        <Field
          name="role_title"
          label="Position title"
          placeholder="Senior Engineer"
          hint="Leave blank to auto-detect from job description"
        />
      </div>

      <Field
        name="job_url"
        label="Job URL"
        type="url"
        placeholder="https://..."
        hint="Optional — saved for your reference"
      />

      <TextareaField
        name="raw_job_text"
        label="Job description"
        required
        rows={16}
        placeholder="Paste the full job description here…"
        hint="Claude will extract requirements, skills, and role summary."
        className="min-h-72 font-mono text-xs"
      />

      {state?.error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Analyzing…" : "Analyze with AI →"}
        </Button>
      </div>
    </form>
  );
}
