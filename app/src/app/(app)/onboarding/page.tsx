"use client";

import { useActionState, useState } from "react";
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
      <Field label="Full name" name="full_name" placeholder="Alex Chen" required />
      <Field
        label="Target role"
        name="target_role"
        placeholder="e.g. Software Engineer, Product Manager"
        required
      />
      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="years_experience">
          Years of experience
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
          {pending ? "Saving…" : "Next →"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Resume upload
// ---------------------------------------------------------------------------

function Step2({ onSuccess, onSkip }: { onSuccess: () => void; onSkip: () => void }) {
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
      <p className="text-sm text-muted-foreground">
        Upload your base resume — we&rsquo;ll parse and store it so AI can tailor
        it for each application.
      </p>
      <label className="flex flex-col gap-1.5" htmlFor="onboarding-file">
        <span className="label-caps">Resume file</span>
        <input
          id="onboarding-file"
          name="file"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="h-10 rounded-sm border border-border bg-background px-3 text-sm file:mr-3 file:rounded-sm file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm"
        />
        <span className="text-xs text-muted-foreground">PDF, DOCX, or plain text. Up to 10 MB.</span>
      </label>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Skip for now
        </button>
        <Button type="submit" disabled={pending}>
          {pending ? "Uploading…" : "Upload and continue →"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Target industries & companies
// ---------------------------------------------------------------------------

function Step3() {
  const [state, action, pending] = useActionState<SaveProfileState, FormData>(
    completeOnboardingAction,
    undefined,
  );

  return (
    <form action={action} className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Tell us what you&rsquo;re targeting — this helps us personalise insights.
      </p>
      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="target_industries">
          Target industries
        </label>
        <input
          id="target_industries"
          name="target_industries"
          type="text"
          placeholder="e.g. Fintech, Healthcare, SaaS"
          className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
        />
        <span className="text-xs text-muted-foreground">Comma-separated.</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="label-caps" htmlFor="target_companies">
          Dream companies
        </label>
        <input
          id="target_companies"
          name="target_companies"
          type="text"
          placeholder="e.g. Stripe, Figma, Notion"
          className="h-10 w-full rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground"
        />
        <span className="text-xs text-muted-foreground">Comma-separated.</span>
      </div>
      {state?.error && <p className="text-sm text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Finishing…" : "Finish setup →"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

const STEP_LABELS = ["Basic info", "Resume", "Preferences"];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  return (
    <div className="mx-auto w-full max-w-lg px-6 py-16">
      <div className="label-caps mb-2">Setup</div>
      <h1 className="font-display text-4xl leading-tight">Welcome to HireMe</h1>
      <p className="mt-2 text-muted-foreground text-sm">
        Let&rsquo;s get your profile ready in 3 quick steps.
      </p>

      <div className="mt-8 flex items-center justify-between">
        <StepIndicator current={step} total={3} />
        <span className="label-caps text-muted-foreground">{STEP_LABELS[step - 1]}</span>
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

      <p className="mt-4 text-center text-xs text-muted-foreground">
        You can update these settings any time from your profile.
      </p>
    </div>
  );
}
