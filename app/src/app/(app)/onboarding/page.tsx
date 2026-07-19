"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import {
  uploadOnboardingResumeAction,
  type UploadOnboardingResumeState,
} from "@/app/actions/onboarding";

const UPLOAD_TIMEOUT_MS = 60_000;

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState<UploadOnboardingResumeState, FormData>(
    uploadOnboardingResumeAction,
    undefined,
  );
  const [hasFile, setHasFile] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const uploadMessages = useMemo(
    () => [
      t("loadingUploading"),
      t("loadingReading"),
      t("loadingAnalyzing"),
      t("loadingBuilding"),
    ],
    [t],
  );

  useEffect(() => {
    if (pending) {
      queueMicrotask(() => {
        setMsgIndex(0);
        setTimedOut(false);
      });
      intervalRef.current = setInterval(() => {
        setMsgIndex((i) => (i + 1 < uploadMessages.length ? i + 1 : i));
      }, 4000);
      timeoutRef.current = setTimeout(() => setTimedOut(true), UPLOAD_TIMEOUT_MS);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [pending, uploadMessages.length]);

  return (
    <div className="app-page">
      <div className="app-page-container app-page-container-narrow">
        <div className="app-page-header rise-enter">
          <div className="label-caps mb-2">{t("setupLabel")}</div>
          <h1 className="app-page-title">{t("heading")}</h1>
          <p className="app-page-subtitle">{t("sub")}</p>
        </div>

        <div className="surface-card app-page-content p-6 rise-enter [transition-delay:40ms] sm:p-8">
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
          {t("resumeRequiredNotice")}
        </div>

        <form action={action} className="flex flex-col gap-5">
          <p className="text-sm leading-6 text-muted-foreground">{t("resumeUploadSub")}</p>
          <label className="flex flex-col gap-1.5" htmlFor="onboarding-file">
            <span className="label-caps">{t("resumeFile")}</span>
            <input
              id="onboarding-file"
              name="file"
              type="file"
              required
              accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
              onChange={(e) => setHasFile(!!e.target.files?.length)}
            />
            <span className="text-xs text-muted-foreground">{t("resumeFileHint")}</span>
          </label>

          {state?.error ? <p className="text-sm text-danger">{state.error}</p> : null}

          {pending ? (
            <div className="flex flex-col gap-2 rounded-md border border-border bg-muted/40 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-border border-t-accent" />
                <span className="text-sm text-foreground">{uploadMessages[msgIndex]}</span>
              </div>
              {timedOut ? (
                <p className="pl-6 text-xs text-muted-foreground">
                  {t("takingLonger")}
                </p>
              ) : null}
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-border">
                <div className="h-full animate-[progress_16s_linear_forwards] rounded-full bg-accent" />
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="submit" disabled={!hasFile}>
                {t("uploadAndContinue")}
              </Button>
            </div>
          )}
        </form>
      </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">{t("profileNote")}</p>
      </div>
    </div>
  );
}
