import { getTranslations } from "next-intl/server";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

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
      className: "border-green-200 bg-green-50 text-green-800",
    };
  }

  if (ratio >= 0.3) {
    return {
      labelKey: "fitModerate",
      className: "border-yellow-200 bg-yellow-50 text-yellow-800",
    };
  }

  return {
    labelKey: "fitLow",
    className: "border-red-200 bg-red-50 text-red-700",
  };
}

export async function JobAnalysisCard({
  job,
  resume,
}: {
  job: ParsedJob;
  resume: ParsedResume | null;
}) {
  const t = await getTranslations("Applications");
  const keySkills = (job.key_skills?.length ? job.key_skills : job.required_skills ?? []).slice(0, 5);
  const verdict = job.verdict ?? job.role_summary ?? null;
  const fit = getFitLabel({ keySkills, resume });

  return (
    <div className="mt-8 flex items-start gap-5 rounded-md border border-border bg-muted/40 p-5 shadow-sm">
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
                className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800"
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
  );
}
