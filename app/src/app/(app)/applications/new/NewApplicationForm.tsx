"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  analyzeJobAction,
  createApplicationAction,
} from "@/app/actions/applications";
import type { ParsedJob } from "@/lib/db/types";
import { Button } from "@/components/ui/Button";
import { Field, TextareaField } from "@/components/ui/Field";

type Step = "input" | "review";
const MAX_JOB_TEXT_LENGTH = 30_000;

export function NewApplicationForm() {
  const t = useTranslations("Applications");

  const [step, setStep] = useState<Step>("input");
  const [error, setError] = useState("");
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();

  // Input-step fields
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [jobUrl, setJobUrl] = useState("");
  const [rawJobText, setRawJobText] = useState("");

  // Review-step editable parsed fields
  const [parsedCompany, setParsedCompany] = useState("");
  const [parsedRole, setParsedRole] = useState("");
  const [parsedLocation, setParsedLocation] = useState("");
  const [parsedSummary, setParsedSummary] = useState("");
  const [parsedRequired, setParsedRequired] = useState("");
  const [parsedDesired, setParsedDesired] = useState("");
  const [parsedResponsibilities, setParsedResponsibilities] = useState("");
  const [parsedJobFull, setParsedJobFull] = useState<ParsedJob | null>(null);

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!rawJobText.trim() && !jobUrl.trim()) {
      setError(t("jobDescriptionOrUrlRequired"));
      return;
    }
    if (jobUrl && !/^https?:\/\//i.test(jobUrl)) {
      setError(t("jobUrlInvalid"));
      return;
    }
    setError("");
    const fd = new FormData();
    fd.set("raw_job_text", rawJobText);
    fd.set("job_url", jobUrl);
    startAnalyze(async () => {
      const result = await analyzeJobAction(undefined, fd);
      if (result?.error) {
        setError(result.error);
      } else if (result?.parsed) {
        const p = result.parsed;
        if (result.rawJobText) setRawJobText(result.rawJobText);
        setParsedCompany(p.company_name ?? companyName);
        setParsedRole(p.role_title ?? roleTitle);
        setParsedLocation(p.location ?? "");
        setParsedSummary(p.role_summary ?? "");
        setParsedRequired((p.required_skills ?? []).join(", "));
        setParsedDesired((p.desired_skills ?? []).join(", "));
        setParsedResponsibilities((p.responsibilities ?? []).join("\n"));
        setParsedJobFull(p);
        setStep("review");
      }
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const mergedJob: ParsedJob = {
      ...(parsedJobFull ?? {}),
      company_name: parsedCompany || undefined,
      role_title: parsedRole || undefined,
      location: parsedLocation || undefined,
      role_summary: parsedSummary || undefined,
      required_skills: parsedRequired
        ? parsedRequired.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      desired_skills: parsedDesired
        ? parsedDesired.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      responsibilities: parsedResponsibilities
        ? parsedResponsibilities.split("\n").map((s) => s.trim()).filter(Boolean)
        : [],
    };
    const fd = new FormData();
    fd.set("company_name", parsedCompany || companyName);
    fd.set("role_title", parsedRole || roleTitle);
    fd.set("job_url", jobUrl);
    fd.set("raw_job_text", rawJobText);
    fd.set("parsed_job_json", JSON.stringify(mergedJob));
    startSave(async () => {
      const result = await createApplicationAction(undefined, fd);
      if (result?.error) setError(result.error);
      // on success, createApplicationAction redirects — no client-side navigation needed
    });
  }

  if (step === "review") {
    return (
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <p className="text-sm text-muted-foreground">{t("reviewSub")}</p>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            name="parsed_company"
            label={t("companyName")}
            maxLength={120}
            value={parsedCompany}
            onChange={(e) => setParsedCompany(e.target.value)}
          />
          <Field
            name="parsed_role"
            label={t("positionTitle")}
            maxLength={120}
            value={parsedRole}
            onChange={(e) => setParsedRole(e.target.value)}
          />
          <Field
            name="parsed_location"
            label={t("location")}
            maxLength={120}
            value={parsedLocation}
            onChange={(e) => setParsedLocation(e.target.value)}
          />
        </div>

        <TextareaField
          name="parsed_summary"
          label={t("roleSummary")}
          rows={3}
          maxLength={2000}
          value={parsedSummary}
          onChange={(e) => setParsedSummary(e.target.value)}
          hint={t("roleSummaryHint")}
        />

        <TextareaField
          name="parsed_required"
          label={t("requiredSkills")}
          rows={3}
          maxLength={2000}
          value={parsedRequired}
          onChange={(e) => setParsedRequired(e.target.value)}
          hint={t("skillsHint")}
        />

        <TextareaField
          name="parsed_desired"
          label={t("desiredSkills")}
          rows={2}
          maxLength={2000}
          value={parsedDesired}
          onChange={(e) => setParsedDesired(e.target.value)}
          hint={t("skillsHint")}
        />

        <TextareaField
          name="parsed_responsibilities"
          label={t("responsibilities")}
          rows={5}
          maxLength={5000}
          value={parsedResponsibilities}
          onChange={(e) => setParsedResponsibilities(e.target.value)}
          hint={t("responsibilitiesHint")}
        />

        {error ? (
          <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        <div className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setStep("input");
              setError("");
            }}
          >
            {t("backButton")}
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? t("saving") : t("confirmSave")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleAnalyze} className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-muted/35 p-5">
        <p className="label-caps mb-2">{t("inputGuideTitle")}</p>
        <div className="grid gap-4 text-sm leading-6 text-muted-foreground md:grid-cols-2">
          <p>{t("inputGuideUrl")}</p>
          <p>{t("inputGuideText")}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="company_name"
          label={t("companyName")}
          placeholder={t("companyNamePlaceholder")}
          hint={t("companyNameHint")}
          maxLength={120}
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />
        <Field
          name="role_title"
          label={t("positionTitle")}
          placeholder={t("positionTitlePlaceholder")}
          hint={t("positionTitleHint")}
          maxLength={120}
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
        />
      </div>

      <Field
        name="job_url"
        label={t("jobUrl")}
        type="url"
        placeholder={t("jobUrlPlaceholder")}
        hint={t("jobUrlHint")}
        maxLength={2000}
        value={jobUrl}
        onChange={(e) => setJobUrl(e.target.value)}
      />

      <TextareaField
        name="raw_job_text"
        label={t("jobDescription")}
        required={!jobUrl.trim()}
        rows={16}
        maxLength={MAX_JOB_TEXT_LENGTH}
        placeholder={t("jobDescriptionPlaceholder")}
        hint={t("jobDescriptionHint")}
        className="min-h-72 font-mono text-xs"
        value={rawJobText}
        onChange={(e) => setRawJobText(e.target.value)}
      />

      {error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={analyzing}>
          {analyzing ? t("analyzing") : t("analyzeWithAI")}
        </Button>
      </div>
    </form>
  );
}
