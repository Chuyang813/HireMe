import type { ParsedJob, ParsedResume } from "@/lib/db/types";
import {
  embedText,
  cosineSimilarity,
  splitIntoSections,
  shouldUseSemanticEvidence,
} from "./embeddings";

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

export function resumeToText(resume: ParsedResume): string {
  const parts: string[] = [];

  for (const exp of (resume.experience ?? [])) {
    const header = [exp.title, exp.company, exp.location, exp.start, exp.end]
      .filter(Boolean)
      .join(' | ');
    const lines = [header, ...(exp.bullets ?? [])].filter(Boolean);
    if (lines.length) parts.push(lines.join('\n'));
  }

  for (const proj of (resume.projects ?? [])) {
    const header = [proj.name, proj.description].filter(Boolean).join(': ');
    const lines = [header, ...(proj.bullets ?? [])].filter(Boolean);
    if (lines.length) parts.push(lines.join('\n'));
  }

  for (const edu of (resume.education ?? [])) {
    const line = [edu.degree, edu.field, edu.school, edu.start, edu.end, edu.notes]
      .filter(Boolean)
      .join(' | ');
    if (line) parts.push(line);
  }

  if (resume.skills?.length) parts.push('Skills: ' + resume.skills.join(', '));
  if (resume.certifications?.length) parts.push('Certifications: ' + resume.certifications.join(', '));

  return parts.join('\n\n');
}

export function jobToText(job: ParsedJob): string {
  return [
    job.role_title,
    job.company_name,
    job.role_summary,
    job.verdict,
    ...(job.responsibilities ?? []),
    ...(job.required_skills ?? []),
    ...(job.desired_skills ?? []),
    ...(job.keywords ?? []),
    ...(job.key_skills ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

export async function selectResumeEvidenceSemantic(
  resumeText: string,
  jobDescription: string,
  topK = 8,
): Promise<string[]> {
  if (!shouldUseSemanticEvidence()) {
    return selectTextEvidenceByOverlap(resumeText, jobDescription, topK);
  }

  try {
    const jdEmbedding = await embedText(jobDescription.slice(0, 4000));

    const sections = splitIntoSections(resumeText);
    if (sections.length === 0) return [resumeText.slice(0, 2000)];

    const sectionEmbeddings: number[][] = [];
    for (const section of sections) {
      sectionEmbeddings.push(await embedText(section));
    }

    const scored = sections.map((section, i) => ({
      section,
      score: cosineSimilarity(jdEmbedding, sectionEmbeddings[i]),
    }));

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => s.section);
  } catch (error) {
    console.warn(
      "[selectResumeEvidenceSemantic] Embedding selection failed, falling back to lexical overlap:",
      error,
    );
    return selectTextEvidenceByOverlap(resumeText, jobDescription, topK);
  }
}

function selectTextEvidenceByOverlap(
  resumeText: string,
  jobDescription: string,
  topK: number,
) {
  const sections = splitIntoSections(resumeText);
  if (sections.length === 0) return [resumeText.slice(0, 2000)];
  const jobTerms = tokenize(jobDescription);

  return sections
    .map((section) => {
      const sectionTerms = tokenize(section);
      const score = [...jobTerms].filter((term) => sectionTerms.has(term)).length;
      return { section, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((item) => item.section);
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
