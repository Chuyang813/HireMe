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

const glassPanel =
  "rounded-2xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-xl";

const gradientButton =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-5 text-[13px] font-medium text-white " +
  "bg-[linear-gradient(135deg,#6366f1,#8b5cf6)] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_8px_24px_rgba(99,102,241,0.30)] " +
  "transition duration-150 ease-out hover:brightness-110 active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const ghostButton =
  "inline-flex h-10 items-center justify-center rounded-lg px-4 text-[13px] font-medium " +
  "text-white/60 border border-white/[0.08] bg-white/[0.03] " +
  "transition duration-150 ease-out hover:text-white hover:bg-white/[0.07] active:scale-[0.97] " +
  "disabled:opacity-50 disabled:pointer-events-none";

const darkInput =
  "h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 text-sm text-white " +
  "placeholder:text-white/25 outline-none transition duration-150 " +
  "focus:border-[#8b5cf6]/60 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)]";

const FIT_STYLES: Record<SkillFit, string> = {
  strong: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  good: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  moderate: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  low: "border-rose-400/30 bg-rose-400/10 text-rose-300",
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
        <span className="bg-gradient-to-b from-white to-white/55 bg-clip-text font-display text-7xl font-semibold leading-none text-transparent tabular-nums">
          {animated}
        </span>
        <span className="text-xl font-medium text-white/30">/100</span>
      </div>
      <span
        className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${FIT_STYLES[match.fit]}`}
      >
        {t(`matchFit_${match.fit}`)}
      </span>
      <p className="max-w-md text-sm leading-relaxed text-white/60">{summary}</p>
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
    <p className="rise-enter rounded-lg border border-rose-400/25 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-300">
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
          className={`rise-enter grid gap-3 p-4 sm:grid-cols-2 ${glassPanel}`}
          style={{ transitionDelay: "40ms" }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
              {t("companyName")}
            </span>
            <input
              className={darkInput}
              name="parsed_company"
              maxLength={120}
              value={parsedCompany}
              onChange={(e) => setParsedCompany(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
              {t("positionTitle")}
            </span>
            <input
              className={darkInput}
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
          <div className={`p-5 ${glassPanel}`}>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-emerald-300/80">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400/15 text-[10px]">
                ✓
              </span>
              {t("matchColumnHave")}
            </p>
            {haveItems.length > 0 ? (
              <ul className="flex flex-col gap-1.5">
                {haveItems.map((item) => (
                  <li
                    key={item.skill}
                    className={`flex items-start gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[13px] text-emerald-200 ${item.required ? "" : "opacity-75"}`}
                  >
                    <span className="mt-px shrink-0 text-emerald-400">✓</span>
                    <span className="min-w-0">
                      {item.skill}
                      {!item.required && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-300/50">
                          {t("matchNiceToHave")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-white/35">{t("matchNoneHave")}</p>
            )}
          </div>

          <div className={`p-5 ${glassPanel}`}>
            <p className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-orange-300/80">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-orange-400/15 text-[10px]">
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
                        ? "border-orange-400/20 bg-orange-400/[0.08] text-orange-200"
                        : "border-orange-400/10 bg-orange-400/[0.04] text-orange-200/75"
                    }`}
                  >
                    <span className="mt-px shrink-0 text-orange-400">●</span>
                    <span className="min-w-0">
                      {item.skill}
                      {!item.required && (
                        <span className="ml-1.5 text-[10px] uppercase tracking-wide text-orange-300/50">
                          {t("matchNiceToHave")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-white/35">{t("matchNoneMissing")}</p>
            )}
          </div>
        </div>

        {/* Suggestions */}
        <div
          className={`rise-enter p-5 ${glassPanel}`}
          style={{ transitionDelay: "120ms" }}
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-white/35">
            {t("matchSuggestionsTitle")}
          </p>
          <ul className="flex flex-col gap-1.5">
            {skillMatch.suggestions.length > 0 ? (
              skillMatch.suggestions.slice(0, 2).map((skill, i) => (
                <li key={skill} className="flex items-start gap-2 text-[13px] leading-relaxed text-white/60">
                  <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#8b5cf6]" />
                  {t(i === 0 ? "matchSuggestionGap" : "matchSuggestionCover", { skill })}
                </li>
              ))
            ) : (
              <li className="flex items-start gap-2 text-[13px] leading-relaxed text-white/60">
                <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#8b5cf6]" />
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
            className={ghostButton}
            onClick={() => {
              setStep("input");
              setError("");
            }}
          >
            {t("backButton")}
          </button>
          <button type="submit" className={gradientButton} disabled={saving}>
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
        <div className={`rise-enter p-6 text-sm leading-relaxed text-white/60 ${glassPanel}`}>
          {t("matchNoResume")}
        </div>
        <div className="flex justify-between">
          <button
            type="button"
            className={ghostButton}
            onClick={() => setStep("input")}
          >
            {t("backButton")}
          </button>
          <button
            type="button"
            className={gradientButton}
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
      {/* Pill segment control */}
      <div className="rise-enter flex justify-center">
        <div className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.04] p-1 backdrop-blur-xl">
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
                  ? "bg-white/[0.14] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
                  : "text-white/45 hover:text-white/75"
              }`}
            >
              {t(key === "paste" ? "tabPasteJd" : "tabFromUrl")}
            </button>
          ))}
        </div>
      </div>

      {tab === "paste" ? (
        <div key="paste" className={`rise-enter p-5 ${glassPanel}`}>
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
              {t("jobDescription")}
            </span>
            <textarea
              name="raw_job_text"
              rows={14}
              maxLength={MAX_JOB_TEXT_LENGTH}
              placeholder={t("jobDescriptionPlaceholder")}
              className="min-h-72 w-full resize-y rounded-xl border border-white/[0.08] bg-black/30 p-4 font-mono text-xs leading-relaxed text-white/85 placeholder:text-white/20 outline-none transition duration-150 focus:border-[#8b5cf6]/60 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.12)]"
              value={rawJobText}
              onChange={(e) => setRawJobText(e.target.value)}
            />
            <span className="text-xs text-white/30">{t("jobDescriptionHint")}</span>
          </label>
        </div>
      ) : (
        <div key="url" className={`rise-enter p-5 ${glassPanel}`}>
          <label className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
              {t("jobUrl")}
            </span>
            <div className="flex gap-2">
              <input
                name="job_url"
                type="url"
                placeholder={t("jobUrlPlaceholder")}
                maxLength={2000}
                className={darkInput}
                value={jobUrl}
                onChange={(e) => setJobUrl(e.target.value)}
              />
              <button type="submit" className={`${gradientButton} shrink-0`} disabled={analyzing}>
                {analyzing ? t("fetching") : t("fetchButton")}
              </button>
            </div>
            <span className="text-xs text-white/30">{t("jobUrlHint")}</span>
          </label>
        </div>
      )}

      {errorBox}

      {tab === "paste" && (
        <div className="rise-enter flex justify-end" style={{ transitionDelay: "60ms" }}>
          <button type="submit" className={gradientButton} disabled={analyzing}>
            {analyzing ? t("analyzing") : t("analyzeWithAI")}
          </button>
        </div>
      )}
    </form>
  );
}
