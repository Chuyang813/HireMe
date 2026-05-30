import { getTranslations } from "next-intl/server";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";
import { calculateATSScore } from "@/lib/ai/ats-score";
import { resumeToText, jobToText } from "@/lib/ai/evidence";

const STOP_WORDS = new Set([
  "and",
  "or",
  "the",
  "with",
  "for",
  "to",
  "in",
  "of",
  "a",
  "an",
  "development",
  "experience",
  "knowledge",
  "familiarity",
]);

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function skillMatchesResume(skill: string, resumeText: string): boolean {
  const normalizedSkill = normalizeText(skill);
  if (!normalizedSkill) return false;
  if (resumeText.includes(normalizedSkill)) return true;

  const terms = normalizedSkill
    .split(" ")
    .filter((term) => term.length > 1 && !STOP_WORDS.has(term));

  if (terms.length === 0) return false;
  const matched = terms.filter((term) => resumeText.includes(term)).length;
  return matched / terms.length >= 0.6;
}

function getFitLabel({
  keySkills,
  resume,
}: {
  keySkills: string[];
  resume: ParsedResume | null;
}): { labelKey: string; className: string } {
  if (!resume) {
    return {
      labelKey: "fitResumeNeeded",
      className: "border-border bg-background text-muted-foreground",
    };
  }

  if (keySkills.length === 0) {
    return {
      labelKey: "fitReview",
      className: "border-border bg-background text-muted-foreground",
    };
  }

  const resumeText = normalizeText(JSON.stringify(resume));
  const matched = keySkills.filter((skill) => skillMatchesResume(skill, resumeText)).length;
  const ratio = matched / keySkills.length;

  if (ratio >= 0.65) {
    return {
      labelKey: "fitGood",
      className: "border-[var(--success)] bg-[var(--success-light)] text-[var(--success)]",
    };
  }

  if (ratio >= 0.3) {
    return {
      labelKey: "fitModerate",
      className: "border-[var(--warning)] bg-[var(--warning-light)] text-[var(--warning)]",
    };
  }

  return {
    labelKey: "fitLow",
    className: "border-[var(--danger)] bg-[var(--danger-light)] text-[var(--danger)]",
  };
}

function scoreColor(n: number): string {
  if (n >= 75) return "#16a34a";
  if (n >= 50) return "#d97706";
  return "#dc2626";
}

export async function JobAnalysisCard({
  job,
  resume,
  rawJobText,
}: {
  job: ParsedJob;
  resume: ParsedResume | null;
  rawJobText?: string | null;
}) {
  const t = await getTranslations("Applications");
  const keySkills = (job.key_skills?.length ? job.key_skills : job.required_skills ?? []).slice(0, 5);
  const verdict = job.verdict ?? job.role_summary ?? null;
  const fit = getFitLabel({ keySkills, resume });

  const resumeText = resume ? resumeToText(resume) : "";
  const jobText = rawJobText?.trim() || jobToText(job);
  const ats = resumeText ? calculateATSScore(resumeText, jobText) : null;

  return (
    <div className="rounded-md border border-border bg-[var(--muted)] p-5 space-y-4">
      {/* Row 1: fit badge + top skills + verdict */}
      <div className="flex items-start gap-5">
        <div className="shrink-0">
          <div
            className={`flex min-h-16 w-24 items-center justify-center rounded-md border px-3 text-center text-sm font-semibold leading-tight ${fit.className}`}
          >
            {t(fit.labelKey)}
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          {keySkills.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {keySkills.map((s) => (
                <span
                  key={s}
                  className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground"
                >
                  {s}
                </span>
              ))}
            </div>
          )}

          {verdict && (
            <p className="text-xs text-muted-foreground leading-relaxed">{verdict}</p>
          )}
        </div>
      </div>

      {/* ATS breakdown — only rendered when the user has a base resume */}
      {ats && (
        <>
          <div className="border-t border-border pt-4 space-y-4">
            {/* Overall score + sub-score bars */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="label-caps">Resume Match</p>
                <span
                  className="text-sm font-semibold tabular-nums"
                  style={{ color: scoreColor(ats.overall) }}
                >
                  {ats.overall}/100
                </span>
              </div>

              <div className="space-y-1.5">
                {(
                  [
                    ["Keyword Match", ats.breakdown.keywordMatch],
                    ["Formatting", ats.breakdown.formatting],
                    ["Readability", ats.breakdown.readability],
                    ["Length", ats.breakdown.lengthScore],
                  ] as [string, number][]
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${value}%`,
                          backgroundColor: scoreColor(value),
                        }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                      {value}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Matched / Missing keywords — two columns */}
            {(ats.matchedKeywords.length > 0 || ats.missingKeywords.length > 0) && (
              <div className="grid grid-cols-2 gap-4">
                {ats.matchedKeywords.length > 0 && (
                  <div>
                    <p className="label-caps mb-2">Matched</p>
                    <div className="flex flex-wrap gap-1">
                      {ats.matchedKeywords.slice(0, 10).map((kw) => (
                        <span
                          key={kw}
                          className="rounded border border-[var(--success)] bg-[var(--success-light)] px-1.5 py-0.5 text-[10px] text-[var(--success)]"
                        >
                          {kw}
                        </span>
                      ))}
                      {ats.matchedKeywords.length > 10 && (
                        <span className="self-center text-[10px] text-muted-foreground">
                          +{ats.matchedKeywords.length - 10}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {ats.missingKeywords.length > 0 && (
                  <div>
                    <p className="label-caps mb-2">Missing</p>
                    <div className="flex flex-wrap gap-1">
                      {ats.missingKeywords.slice(0, 8).map((kw) => (
                        <span
                          key={kw}
                          className="rounded border border-[var(--warning)] bg-[var(--warning-light)] px-1.5 py-0.5 text-[10px] text-[var(--warning)]"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Improvement suggestions */}
            {ats.suggestions.length > 0 && (
              <div>
                <p className="label-caps mb-2">Suggestions</p>
                <ul className="space-y-1.5">
                  {ats.suggestions.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                    >
                      <span className="mt-0.5 shrink-0">◆</span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
