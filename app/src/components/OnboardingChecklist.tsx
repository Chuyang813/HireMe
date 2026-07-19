"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

const DISMISS_KEY = "hireme-onboarding-dismissed";

interface Props {
  hasApplication: boolean;
  hasGeneratedDocument: boolean;
  firstApplicationId: string | null;
}

function CheckIcon({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background text-xs font-medium text-muted-foreground" />
  );
}

function StepNumber({ n, done, active }: { n: number; done: boolean; active: boolean }) {
  if (done) return <CheckIcon done />;
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-xs font-medium ${
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground"
      }`}
    >
      {n}
    </span>
  );
}

export function OnboardingChecklist({ hasApplication, hasGeneratedDocument, firstApplicationId }: Props) {
  const t = useTranslations("OnboardingChecklist");
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid flash

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem(DISMISS_KEY);
      setDismissed(stored === "true");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const allDone = hasApplication && hasGeneratedDocument;

  if (dismissed || allDone) return null;

  const step2Active = !hasApplication;
  const step3Active = hasApplication && !hasGeneratedDocument;

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  }

  const docTarget =
    firstApplicationId
      ? `/applications/${firstApplicationId}?tab=resume`
      : "/applications";

  return (
    <div className="surface-card p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="label-caps mb-1">{t("label")}</p>
          <h2 className="font-display text-lg leading-tight sm:text-2xl">{t("heading")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("sub")}</p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          aria-label={t("dismiss")}
        >
          {t("dismiss")}
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-6 flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{
              width: hasGeneratedDocument ? "100%" : hasApplication ? "66%" : "33%",
            }}
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">
          {hasGeneratedDocument ? 3 : hasApplication ? 2 : 1}/3
        </span>
      </div>

      <ol className="space-y-4">
        {/* Step 1 — always done on dashboard */}
        <li className="flex items-start gap-3.5">
          <StepNumber n={1} done active={false} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug text-muted-foreground line-through">
              {t("step1Title")}
            </p>
          </div>
        </li>

        {/* Step 2 */}
        <li className="flex items-start gap-3.5">
          <StepNumber n={2} done={hasApplication} active={step2Active} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium leading-snug ${hasApplication ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {t("step2Title")}
            </p>
            {step2Active && (
              <>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("step2Body")}</p>
                <Link
                  href="/applications/new"
                  className="mt-2.5 inline-flex h-8 items-center rounded-md bg-accent px-3.5 text-xs font-medium text-accent-foreground transition duration-150 ease-out hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                >
                  {t("step2Cta")}
                </Link>
              </>
            )}
          </div>
        </li>

        {/* Step 3 */}
        <li className="flex items-start gap-3.5">
          <StepNumber n={3} done={hasGeneratedDocument} active={step3Active} />
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-medium leading-snug ${hasGeneratedDocument ? "text-muted-foreground line-through" : step3Active ? "text-foreground" : "text-muted-foreground"}`}>
              {t("step3Title")}
            </p>
            {step3Active && (
              <>
                <p className="mt-0.5 text-xs text-muted-foreground">{t("step3Body")}</p>
                <Link
                  href={docTarget}
                  className="mt-2.5 inline-flex h-8 items-center rounded-md bg-accent px-3.5 text-xs font-medium text-accent-foreground transition duration-150 ease-out hover:bg-[var(--accent-hover)] active:scale-[0.97]"
                >
                  {t("step3Cta")}
                </Link>
              </>
            )}
          </div>
        </li>
      </ol>
    </div>
  );
}
