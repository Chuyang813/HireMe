"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import {
  saveProfileStep1Action,
  uploadOnboardingResumeAction,
  completeOnboardingAction,
  type SaveProfileState,
  type UploadOnboardingResumeState,
} from "@/app/actions/onboarding";

// ---------------------------------------------------------------------------
// Step indicators
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium ${
              i + 1 === current
                ? "border-foreground bg-foreground text-background"
                : i + 1 < current
                ? "border-muted-foreground bg-muted text-muted-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {i + 1 < current ? "✓" : i + 1}
          </span>
          {i < total - 1 && (
            <div className={`h-px w-8 ${i + 1 < current ? "bg-muted-foreground" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Basic info
// ---------------------------------------------------------------------------

function Step1({ onSuccess }: { onSuccess: () => void }) {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(
    saveProfileStep1Action,
    undefined,
  );

  if (state?.ok) {
    onSuccess();
    return null;
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <Field label={t("fullName")} name="full_name" placeholder={t("fullNamePlaceholder")} required />
      <Field
        label={t("targetRole")}
        name="target_role"
        placeholder={t("targetRolePlaceholder")}
        required
      />
      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="years_experience">
          {t("yearsExperience")}
        </label>
        <input
          id="years_experience"
          name="years_experience"
          type="number"
          min="0"
          max="50"
          placeholder="3"
          className="h-10 w-32 rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
        />
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("saving") : t("next")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Resume upload
// ---------------------------------------------------------------------------

function Step2({ onSuccess, onSkip }: { onSuccess: () => void; onSkip: () => void }) {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState<UploadOnboardingResumeState, FormData>(
    uploadOnboardingResumeAction,
    undefined,
  );

  if (state?.ok) {
    onSuccess();
    return null;
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("resumeUploadSub")}</p>
      <label className="flex flex-col gap-1.5" htmlFor="onboarding-file">
        <span className="label-caps">{t("resumeFile")}</span>
        <input
          id="onboarding-file"
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="h-10 rounded-sm border border-border bg-background px-3 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
        />
        <span className="text-xs text-muted-foreground">{t("resumeFileHint")}</span>
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          {t("skipForNow")}
        </button>
        <Button type="submit" disabled={pending}>
          {pending ? t("uploading") : t("uploadAndContinue")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Target industries & companies
// ---------------------------------------------------------------------------

function Step3() {
  const t = useTranslations("Onboarding");
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(
    completeOnboardingAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">{t("targetIndustriesSub")}</p>
      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="target_industries">
          {t("targetIndustries")}
        </label>
        <input
          id="target_industries"
          name="target_industries"
          type="text"
          placeholder={t("targetIndustriesPlaceholder")}
          className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
        />
        <span className="text-xs text-muted-foreground">{t("commaSeparated")}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="target_companies">
          {t("dreamCompanies")}
        </label>
        <input
          id="target_companies"
          name="target_companies"
          type="text"
          placeholder={t("dreamCompaniesPlaceholder")}
          className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
        />
        <span className="text-xs text-muted-foreground">{t("commaSeparated")}</span>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? t("finishing") : t("finishSetup")}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const t = useTranslations("Onboarding");
  const [step, setStep] = useState(1);

  const stepLabels = [t("stepBasicInfo"), t("stepResume"), t("stepPreferences")];

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-16">
      <div className="label-caps mb-2">{t("setupLabel")}</div>
      <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
      <p className="mt-2 text-muted-foreground text-sm">{t("sub")}</p>

      <div className="mt-8 flex items-center justify-between">
        <StepIndicator current={step} total={3} />
        <span className="label-caps text-muted-foreground">{stepLabels[step - 1]}</span>
      </div>

      <div className="mt-8 rounded-sm border border-border bg-background p-6">
        {step === 1 && <Step1 onSuccess={() => setStep(2)} />}
        {step === 2 && (
          <Step2
            onSuccess={() => setStep(3)}
            onSkip={() => setStep(3)}
          />
        )}
        {step === 3 && <Step3 />}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">{t("profileNote")}</p>
    </div>
  );
}
