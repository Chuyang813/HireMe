import type { ParsedJob, ParsedResume } from "@/lib/db/types";
import { bm25Score } from "./embeddings";
import { resumeToText, jobToText } from "./evidence";
import { calculateATSScore } from "./ats-score";

export type SkillFit = "strong" | "good" | "moderate" | "low";

export interface SkillMatchItem {
  skill: string;
  required: boolean;
}

export interface SkillMatch {
  score: number;
  fit: SkillFit;
  have: SkillMatchItem[];
  missing: SkillMatchItem[];
  requiredHave: number;
  requiredTotal: number;
  suggestions: string[];
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.]+/g, " ").trim();
}

function skillTokens(skill: string): string[] {
  return normalize(skill)
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/**
 * A skill counts as present when the resume contains it verbatim, or when
 * BM25 term matching covers most of the skill's tokens. bm25Score contributes
 * at least 1.0 per skill token found in the resume, so a score >= 60% of the
 * token count means the majority of terms appear.
 */
function resumeHasSkill(skill: string, resumeTextNormalized: string, resumeText: string): boolean {
  const normalizedSkill = normalize(skill);
  if (!normalizedSkill) return false;
  if (resumeTextNormalized.includes(normalizedSkill)) return true;

  const tokens = skillTokens(skill);
  if (tokens.length === 0) return false;
  return bm25Score(skill, resumeText) >= Math.max(1, tokens.length * 0.6);
}

function fitForScore(score: number): SkillFit {
  if (score >= 75) return "strong";
  if (score >= 55) return "good";
  if (score >= 35) return "moderate";
  return "low";
}

function dedupe(skills: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of skills) {
    const key = normalize(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s.trim());
  }
  return out;
}

export function computeSkillMatch(
  resume: ParsedResume | null,
  resumeRawText: string | null,
  job: ParsedJob,
  rawJobText: string,
): SkillMatch | null {
  const resumeText = resume ? resumeToText(resume) : (resumeRawText ?? "");
  if (!resumeText.trim()) return null;

  const required = dedupe(job.required_skills ?? []);
  // When the parser found no explicit required skills, fall back to key skills
  // so the comparison view still has something to show.
  const requiredSet = required.length > 0 ? required : dedupe(job.key_skills ?? job.keywords ?? []);
  const requiredIsExplicit = required.length > 0;
  const desired = dedupe(job.desired_skills ?? []).filter(
    (d) => !requiredSet.some((r) => normalize(r) === normalize(d)),
  );

  const resumeTextNormalized = normalize(resumeText);
  const have: SkillMatchItem[] = [];
  const missing: SkillMatchItem[] = [];

  for (const skill of requiredSet) {
    (resumeHasSkill(skill, resumeTextNormalized, resumeText) ? have : missing).push({
      skill,
      required: requiredIsExplicit,
    });
  }
  for (const skill of desired) {
    (resumeHasSkill(skill, resumeTextNormalized, resumeText) ? have : missing).push({
      skill,
      required: false,
    });
  }

  const weight = (item: SkillMatchItem) => (item.required ? 2 : 1);
  const weightedHave = have.reduce((sum, i) => sum + weight(i), 0);
  const weightedTotal = weightedHave + missing.reduce((sum, i) => sum + weight(i), 0);
  const coverage = weightedTotal > 0 ? weightedHave / weightedTotal : 0;

  // Blend explicit skill coverage with the broader lexical keyword match so a
  // resume that speaks the JD's language scores above one that only name-drops.
  const jdText = rawJobText.trim() || jobToText(job);
  const keywordMatch = calculateATSScore(resumeText, jdText).breakdown.keywordMatch;
  const score =
    weightedTotal > 0
      ? Math.round(coverage * 100 * 0.7 + keywordMatch * 0.3)
      : keywordMatch;

  const requiredItems = requiredIsExplicit
    ? [...have, ...missing].filter((i) => i.required)
    : [...have, ...missing];
  const requiredHave = requiredIsExplicit
    ? have.filter((i) => i.required).length
    : have.length;

  const suggestions: string[] = [];
  const topMissing = missing.filter((i) => i.required).concat(missing.filter((i) => !i.required));
  if (topMissing.length > 0) {
    suggestions.push(topMissing[0].skill);
    if (topMissing.length > 1) suggestions.push(topMissing[1].skill);
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    fit: fitForScore(Math.max(0, Math.min(100, score))),
    have,
    missing,
    requiredHave,
    requiredTotal: requiredItems.length,
    suggestions,
  };
}
