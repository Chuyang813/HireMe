"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  analyzeJobAction,
  createApplicationAction,
} from "@/app/actions/applications";
import type { ParsedJob } from "@/lib/db/types";
import type { SkillMatch, SkillFit } from "@/lib/ai/skill-match";

type Step = "input" | "match";
type InputTab = "paste" | "url";
const MAX_JOB_TEXT_LENGTH = 30_000;

// Linear-inspired light system (see DESIGN.md): white cards on #fafafa,
// hairline borders, 12px card radius, 8px control radius, single lavender accent.
const ACCENT = "#5e6ad2";

const cardPanel =
  "rounded-xl border border-black/[0.08] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]";

const primaryButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-5 text-[13px] font-medium text-white " +
  "bg-[#5e6ad2] transition duration-150 ease-out hover:bg-[#4d58bd] active:scale-[0.97] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5e6ad2]/50 " +
  "disabled:opacity-50 disabled:pointer-events-none";

const secondaryButton =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-[13px] font-medium " +
  "text-muted-foreground border border-black/[0.08] bg-white " +
  "transition duration-150 ease-out hover:text-foreground hover:bg-[var(--bg-hover)] active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const lightInput =
  "h-10 w-full rounded-lg border border-black/[0.08] bg-white px-3 text-sm text-foreground " +
  "placeholder:text-[var(--text-placeholder)] outline-none transition duration-150 " +
  "focus:border-[#5e6ad2] focus:shadow-[0_0_0_3px_rgba(94,106,210,0.15)]";

const FIT_STYLES: Record<SkillFit, string> = {
  strong: "border-green-200 bg-green-50 text-green-700",
  good: "border-[#5e6ad2]/25 bg-[#5e6ad2]/[0.08] text-[#4d58bd]",
  moderate: "border-amber-200 bg-amber-50 text-amber-700",
  low: "border-red-200 bg-red-50 text-red-700",
};

function useCountUp(target: number, durationMs = 800): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function ScoreHero({ match, summary }: { match: SkillMatch; summary: string }) {
  const t = useTranslations("Applications");
  const animated = useCountUp(match.score);
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex items-baseline gap-1">
        <span className="font-display text-7xl font-semibold leading-none text-foreground tabular-nums tracking-tight">
          {animated}
        </span>
        <span className="text-xl font-medium text-muted-foreground/60">/100</span>
      </div>
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${FIT_STYLES[match.fit]}`}
      >
        {t(`matchFit_${match.fit}`)}
      </span>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">{summary}</p>
    </div>
  );
}

export function NewApplicationForm() {
  const t = useTranslations("Applications");

  const [step, setStep] = useState<Step>("input");
  const [tab, setTab] = useState<InputTab>("paste");
  const [error, setError] = useState("");
  const [analyzing, startAnalyze] = useTransition();
  const [saving, startSave] = useTransition();

  const [jobUrl, setJobUrl] = useState("");
  const [rawJobText, setRawJobText] = useState("");

  const [parsedCompany, setParsedCompany] = useState("");
  const [parsedRole, setParsedRole] = useState("");
  const [parsedJobFull, setParsedJobFull] = useState<ParsedJob | null>(null);
  const [skillMatch, setSkillMatch] = useState<SkillMatch | null>(null);

  function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    const usingUrl = tab === "url";
    if (usingUrl && !jobUrl.trim()) {
      setError(t("jobUrlRequired"));
      return;
    }
    if (usingUrl && !/^https?:\/\//i.test(jobUrl)) {
      setError(t("jobUrlInvalid"));
      return;
    }
    if (!usingUrl && !rawJobText.trim()) {
      setError(t("jobDescriptionRequired"));
      return;
    }
    setError("");
    const fd = new FormData();
    fd.set("raw_job_text", usingUrl ? "" : rawJobText);
    fd.set("job_url", usingUrl ? jobUrl : "");
    startAnalyze(async () => {
      const result = await analyzeJobAction(undefined, fd);
      if (result?.error) {
        setError(result.error);
      } else if (result?.parsed) {
        const p = result.parsed;
        if (result.rawJobText) setRawJobText(result.rawJobText);
        setParsedCompany(p.company_name ?? "");
        setParsedRole(p.role_title ?? "");
        setParsedJobFull(p);
        setSkillMatch(result.skillMatch ?? null);
        setStep("match");
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
    };
    const fd = new FormData();
    fd.set("company_name", parsedCompany);
    fd.set("role_title", parsedRole);
    fd.set("job_url", tab === "url" ? jobUrl : "");
    fd.set("raw_job_text", rawJobText);
    fd.set("parsed_job_json", JSON.stringify(mergedJob));
    startSave(async () => {
      const result = await createApplicationAction(undefined, fd);
      if (result?.error) setError(result.error);
      // on success, createApplicationAction redirects — no client-side navigation needed
    });
  }

  const errorBox = error ? (
    <p className="rise-enter rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
      {error}
    </p>
  ) : null;

  if (step === "match" && skillMatch) {
    const haveItems = skillMatch.have;
    const missingItems = skillMatch.missing;
    const summary = t(`matchSummary_${skillMatch.fit}`, {
      have: skillMatch.requiredHave,
      total: skillMatch.requiredTotal,
    });

    return (
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        <div className="rise-enter">
          <ScoreHero match={skillMatch} summary={summary} />
        </div>

        {/* Detected company / role — editable in case auto-detect missed */}
        <div
          className={`rise-enter grid gap-3 p-4 sm:grid-cols-2 ${cardPanel}`}
          style={{ transitionDelay: "40ms" }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">{t("companyName")}</span>
            <input
              className={lightInput}
              name="parsed_company"
              maxLength={120}
              value={parsedCompany}
              onChange={(e) => setParsedCompany(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="label-caps">{t("positionTitle")}</span>
            <input
              className={lightInput}
              name="parsed_role"
              maxLength={120}
              value={parsedRole}
              onChange={(e) => setParsedRole(e.target.value)}
            />
          </label>
        </div>

        {/* Two-column skill comparison */}
        <div
          className="rise-enter grid gap-4 sm:grid-cols-2"
          style={{ transitionDelay: "80ms" }}
        >
          <div className={`p-5 ${cardPanel}`}>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-green-700">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-green-100 text-[10px] text-green-700">
                ✓
              </span>
              {t("matchColumnHave")}
            </p>
            {haveItems.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {haveItems.map((item) => (
                  <li
                    key={item.skill}
                    className={`flex items-start gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-[13px] text-green-800 ${item.required ? "" : "opacity-80"}`}
                  >
                    <span className="mt-px shrink-0 text-green-600">✓</span>
                    <span className="min-w-0">
                      {item.skill}
                      {!item.required && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-green-600/60">
                          {t("matchNiceToHave")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t("matchNoneHave")}</p>
            )}
          </div>

          <div className={`p-5 ${cardPanel}`}>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-orange-700">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-100 text-[10px] text-orange-700">
                !
              </span>
              {t("matchColumnMissing")}
            </p>
            {missingItems.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {missingItems.map((item) => (
                  <li
                    key={item.skill}
                    className={`flex items-start gap-2 rounded-lg border px-3 py-1.5 text-[13px] ${
                      item.required
                        ? "border-orange-200 bg-orange-50 text-orange-800"
                        : "border-orange-100 bg-orange-50/50 text-orange-700/80"
                    }`}
                  >
                    <span className="mt-px shrink-0 text-orange-500">●</span>
                    <span className="min-w-0">
                      {item.skill}
                      {!item.required && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-orange-600/60">
                          {t("matchNiceToHave")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t("matchNoneMissing")}</p>
            )}
          </div>
        </div>

        {/* Suggestions */}
        <div
          className={`rise-enter p-5 ${cardPanel}`}
          style={{ transitionDelay: "120ms" }}
        >
          <p className="label-caps mb-2">{t("matchSuggestionsTitle")}</p>
          <ul className="flex flex-col gap-1.5">
            {skillMatch.suggestions.length > 0 ? (
              skillMatch.suggestions.slice(0, 2).map((skill, i) => (
                <li
                  key={skill}
                  className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground"
                >
                  <span
                    className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: ACCENT }}
                  />
                  {t(i === 0 ? "matchSuggestionGap" : "matchSuggestionCover", { skill })}
                </li>
              ))
            ) : (
              <li className="flex items-start gap-2 text-[13px] leading-relaxed text-muted-foreground">
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full"
                  style={{ backgroundColor: ACCENT }}
                />
                {t("matchAllCovered")}
              </li>
            )}
          </ul>
        </div>

        {errorBox}

        <div
          className="rise-enter flex justify-between"
          style={{ transitionDelay: "160ms" }}
        >
          <button
            type="button"
            className={secondaryButton}
            onClick={() => {
              setStep("input");
              setError("");
            }}
          >
            {t("backButton")}
          </button>
          <button type="submit" className={primaryButton} disabled={saving}>
            {saving ? t("saving") : t("confirmSave")}
          </button>
        </div>
      </form>
    );
  }

  if (step === "match") {
    // Analysis succeeded but the base resume had no readable text
    return (
      <div className="flex flex-col gap-6">
        <div className={`rise-enter p-6 text-sm leading-relaxed text-muted-foreground ${cardPanel}`}>
          {t("matchNoResume")}
        </div>
        <div className="flex justify-between">
          <button
            type="button"
            className={secondaryButton}
            onClick={() => setStep("input")}
          >
            {t("backButton")}
          </button>
          <button
            type="button"
            className={primaryButton}
            disabled={saving}
            onClick={(e) => handleSave(e as unknown as React.FormEvent)}
          >
            {saving ? t("saving") : t("confirmSave")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleAnalyze} className="flex flex-col gap-6">
      {/* Pill segment control — macOS style: gray track, white active pill */}
      <div className="rise-enter flex justify-center">
        <div className="inline-flex rounded-full border border-black/[0.06] bg-[#f4f4f5] p-1">
          {(["paste", "url"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTab(key);
                setError("");
              }}
              aria-pressed={tab === key}
              className={`rounded-full px-5 py-1.5 text-[13px] font-medium transition duration-150 ease-out active:scale-[0.97] ${
                tab === key
                  ? "bg-white text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t(key === "paste" ? "tabPasteJd" : "tabFromUrl")}
            </button>
          ))}
        </div>
      </div>

      {tab === "paste" ? (
        <div key="paste" className={`rise-enter p-5 ${cardPanel}`}>
          <label className="flex flex-col gap-2">
            <span className="label-caps">{t("jobDescription")}</span>
            <textarea
              name="raw_job_text"
              rows={14}
              maxLength={MAX_JOB_TEXT_LENGTH}
              placeholder={t("jobDescriptionPlaceholder")}
              className="min-h-72 w-full resize-y rounded-lg border border-black/[0.08] bg-[#fafafa] p-4 font-mono text-xs leading-relaxed text-foreground placeholder:text-[var(--text-placeholder)] outline-none transition duration-150 focus:border-[#5e6ad2] focus:bg-white focus:shadow-[0_0_0_3px_rgba(94,106,210,0.15)]"
              value={rawJobText}
              onChange={(e) => setRawJobText(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">{t("jobDescriptionHint")}</span>
          </label>
        </div>
      ) : (
        <div key="url" className={`rise-enter p-5 ${cardPanel}`}>
          <label className="flex flex-col gap-2">
            <span className="label-caps">{t("jobUrl")}</span>
            <div className="flex gap-2">
              <input
                name="job_url"
                type="url"
                placeholder={t("jobUrlPlaceholder")}
                maxLength={2000}
                className={lightInput}
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
              />
              <button type="submit" className={`${primaryButton} shrink-0`} disabled={analyzing}>
                {analyzing ? t("fetching") : t("fetchButton")}
              </button>
            </div>
            <span className="text-xs text-muted-foreground">{t("jobUrlHint")}</span>
          </label>
        </div>
      )}

      {errorBox}

      {tab === "paste" && (
        <div className="rise-enter flex justify-end" style={{ transitionDelay: "60ms" }}>
          <button type="submit" className={primaryButton} disabled={analyzing}>
            {analyzing ? t("analyzing") : t("analyzeWithAI")}
          </button>
        </div>
      )}
    </form>
  );
}
