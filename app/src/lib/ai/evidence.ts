import type { ParsedJob, ParsedResume } from "@/lib/db/types";

export type ResumeEvidence = {
  source: "experience" | "project" | "education" | "skill" | "certification";
  label: string;
  text: string;
  matchedTerms: string[];
  score: number;
};

const STOPWORDS = new Set([
  "and",
  "for",
  "the",
  "with",
  "you",
  "will",
  "are",
  "this",
  "that",
  "from",
  "have",
  "role",
  "work",
]);

export function selectResumeEvidence({
  resume,
  job,
  limit = 8,
}: {
  resume: ParsedResume;
  job: ParsedJob;
  limit?: number;
}): ResumeEvidence[] {
  const jobTerms = extractJobTerms(job);
  const evidence = extractResumeEvidence(resume);

  return evidence
    .map((item) => {
      const textTokens = tokenize(`${item.label} ${item.text}`);
      const matchedTerms = [...jobTerms].filter((term) => textTokens.has(term));
      return {
        ...item,
        matchedTerms,
        score: matchedTerms.length,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, limit);
}

export function formatResumeEvidence(evidence: ResumeEvidence[]) {
  if (!evidence.length) {
    return "No high-confidence resume evidence matched the parsed job requirements.";
  }

  return evidence
    .map((item) => {
      const terms = item.matchedTerms.join(", ");
      return `- [${item.source}] ${item.label}: ${item.text} (matched: ${terms})`;
    })
    .join("\n");
}

function extractJobTerms(job: ParsedJob) {
  return tokenize(
    [
      job.role_title,
      job.role_summary,
      job.verdict,
      ...(job.responsibilities ?? []),
      ...(job.required_skills ?? []),
      ...(job.desired_skills ?? []),
      ...(job.keywords ?? []),
      ...(job.key_skills ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function extractResumeEvidence(resume: ParsedResume): Omit<ResumeEvidence, "matchedTerms" | "score">[] {
  const evidence: Omit<ResumeEvidence, "matchedTerms" | "score">[] = [];

  resume.experience?.forEach((item) => {
    const label = [item.title, item.company].filter(Boolean).join(" at ") || "Experience";
    const text = [item.location, item.start, item.end, ...(item.bullets ?? [])]
      .filter(Boolean)
      .join(" ");
    if (text) evidence.push({ source: "experience", label, text });
  });

  resume.projects?.forEach((item) => {
    const text = [item.description, ...(item.bullets ?? []), ...(item.links ?? [])]
      .filter(Boolean)
      .join(" ");
    if (item.name || text) {
      evidence.push({ source: "project", label: item.name ?? "Project", text });
    }
  });

  resume.education?.forEach((item) => {
    const label = [item.degree, item.school].filter(Boolean).join(" at ") || "Education";
    const text = [item.field, item.start, item.end, item.notes].filter(Boolean).join(" ");
    if (label || text) evidence.push({ source: "education", label, text });
  });

  resume.skills?.forEach((skill) => {
    evidence.push({ source: "skill", label: skill, text: skill });
  });

  resume.certifications?.forEach((certification) => {
    evidence.push({
      source: "certification",
      label: certification,
      text: certification,
    });
  });

  return evidence;
}

function tokenize(text: string) {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+.#-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));

  return new Set(tokens);
}
