"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { uploadResumeAction, type UploadState } from "./actions";
import { Field } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";

const LOADING_MESSAGES = [
  "Uploading your resume…",
  "Reading document…",
  "AI is analyzing your experience…",
  "Building your profile…",
];

const TIMEOUT_MS = 60_000;

export function UploadForm() {
  const [state, action, pending] = useActionState<UploadState, FormData>(
    uploadResumeAction,
    undefined,
  );

  const [msgIndex, setMsgIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pending) {
      queueMicrotask(() => {
        setMsgIndex(0);
        setTimedOut(false);
      });

      intervalRef.current = setInterval(() => {
        setMsgIndex((i) => (i + 1 < LOADING_MESSAGES.length ? i + 1 : i));
      }, 4000);

      timeoutRef.current = setTimeout(() => {
        setTimedOut(true);
      }, TIMEOUT_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pending]);

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
        <span className="text-xs text-muted-foreground">PDF, DOCX, or plain text. Up to 10 MB.</span>
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

      {/* Loading state */}
      {pending && (
        <div className="flex flex-col gap-2 rounded-sm border border-border bg-muted/40 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent" />
            <span className="text-sm text-foreground">{LOADING_MESSAGES[msgIndex]}</span>
          </div>
          {timedOut && (
            <p className="text-xs text-muted-foreground pl-6.5">
              This is taking longer than usual — still working, please wait…
            </p>
          )}
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
            <div className="h-full animate-[progress_16s_linear_forwards] rounded-full bg-accent" />
          </div>
        </div>
      )}

      {/* Error state */}
      {!pending && state?.error && (
        <div className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3">
          <p className="text-sm text-danger">{state.error}</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Check the file format and size, then try again.
          </p>
        </div>
      )}

      {!pending && (
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            Upload and parse
          </Button>
          <span className="text-xs text-muted-foreground">
            We&rsquo;ll extract the text and build a structured profile.
          </span>
        </div>
      )}
    </form>
  );
}
