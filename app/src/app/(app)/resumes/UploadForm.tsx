"use client";

import { useActionState } from "react";
import { uploadResumeAction, type UploadState } from "./actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadResumeAction,
    undefined,
  );
  return (
    <form action={action} className="flex flex-col gap-5">
      <Field
        label="Title"
        name="title"
        placeholder="e.g. Software Engineer — 2026"
        required
      />
      <label className="flex flex-col gap-1.5" htmlFor="file">
        <span className="label-caps">Resume file</span>
        <input
          id="file"
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          required
          className="h-10 rounded-sm border border-border bg-background px-3 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
        />
        <span className="text-xs text-muted-foreground">
          PDF, DOCX, or plain text. Up to 10 MB.
        </span>
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isDefault"
          className="h-4 w-4 rounded-sm border-border"
          defaultChecked
        />
        Set as my default resume
      </label>
      {state?.error ? (
        <p className="text-sm text-danger">{state.error}</p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload and parse"}
        </Button>
        <span className="text-xs text-muted-foreground">
          We&rsquo;ll extract the text and build a structured profile.
        </span>
      </div>
    </form>
  );
}
