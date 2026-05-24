import type { DocumentType, ParsedJob, ParsedResume } from "@/lib/db/types";

export type GroundingWarning = {
  kind: "email" | "url" | "number" | "entity";
  value: string;
  message: string;
  severity: "low" | "medium" | "high";
};

const COMMON_ENTITY_TERMS = new Set([
  "AI",
  "API",
  "APIs",
  "Best",
  "Cover Letter",
  "Dear Hiring Manager",
  "Email",
  "Hiring Manager",
  "Resume",
  "Subject",
]);

const DOCUMENT_TYPES_TO_CHECK = new Set<DocumentType>([
  "tailored_resume",
  "cover_letter",
  "email_draft",
  "interview_prep",
]);

export function checkGeneratedDocumentGrounding({
  content,
  documentType,
  resume,
  job,
  rawResumeText,
  rawJobText,
}: {
  content: string;
  documentType: DocumentType;
  resume: ParsedResume;
  job: ParsedJob | null;
  rawResumeText?: string | null;
  rawJobText?: string | null;
}): GroundingWarning[] {
  if (!DOCUMENT_TYPES_TO_CHECK.has(documentType) || !content.trim()) {
    return [];
  }

  const evidence = buildEvidenceText({ resume, job, rawResumeText, rawJobText });
  const normalizedEvidence = normalizeForSearch(evidence);
  const warnings: GroundingWarning[] = [];

  addUnsupportedValues({
    kind: "email",
    severity: "high",
    values: extractMatches(content, /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/g),
    normalizedEvidence,
    warnings,
    message: (value) => `Email address "${value}" was not found in the resume or job posting.`,
  });

  addUnsupportedValues({
    kind: "url",
    severity: "high",
    values: extractMatches(content, /\b(?:https?:\/\/|www\.)[^\s)]+/gi),
    normalizedEvidence,
    warnings,
    message: (value) => `Link "${value}" was not found in the resume or job posting.`,
  });

  addUnsupportedValues({
    kind: "number",
    severity: "medium",
    values: extractImportantNumbers(content),
    normalizedEvidence,
    warnings,
    message: (value) => `Metric or date "${value}" was not found in the resume or job posting.`,
  });

  const sourceTerms = collectSourceTerms(resume, job);
  for (const entity of extractPossibleEntities(content)) {
    if (
      sourceTerms.has(normalizeTerm(entity)) ||
      normalizedEvidence.includes(normalizeForSearch(entity))
    ) {
      continue;
    }
    warnings.push({
      kind: "entity",
      value: entity,
      severity: "low",
      message: `Named entity "${entity}" may need review because it was not found in the source material.`,
    });
  }

  return dedupeWarnings(warnings).slice(0, 12);
}

function buildEvidenceText({
  resume,
  job,
  rawResumeText,
  rawJobText,
}: {
  resume: ParsedResume;
  job: ParsedJob | null;
  rawResumeText?: string | null;
  rawJobText?: string | null;
}) {
  return [
    rawResumeText,
    rawJobText,
    JSON.stringify(resume),
    job ? JSON.stringify(job) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizeForSearch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@.+/%$-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerm(value: string) {
  return normalizeForSearch(value).replace(/\s+/g, " ");
}

function extractMatches(content: string, pattern: RegExp) {
  return [...content.matchAll(pattern)].map((match) => match[0].replace(/[.,;:]+$/, ""));
}

function extractImportantNumbers(content: string) {
  const values = extractMatches(
    content,
    /(?:\$?\d+(?:,\d{3})*(?:\.\d+)?%?|\b\d{4}\b)/g,
  );

  return values.filter((value) => {
    const numeric = Number(value.replace(/[$,%]/g, ""));
    if (Number.isNaN(numeric)) return false;
    return value.includes("$") || value.includes("%") || numeric >= 1900 || numeric >= 10;
  });
}

function addUnsupportedValues({
  kind,
  severity,
  values,
  normalizedEvidence,
  warnings,
  message,
}: {
  kind: GroundingWarning["kind"];
  severity: GroundingWarning["severity"];
  values: string[];
  normalizedEvidence: string;
  warnings: GroundingWarning[];
  message: (value: string) => string;
}) {
  for (const value of values) {
    if (!normalizedEvidence.includes(normalizeForSearch(value))) {
      warnings.push({ kind, value, severity, message: message(value) });
    }
  }
}

function collectSourceTerms(resume: ParsedResume, job: ParsedJob | null) {
  const terms = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim().length >= 3) {
      terms.add(normalizeTerm(value));
    }
  };

  add(resume.name);
  add(resume.summary);
  resume.contact?.links?.forEach(add);
  resume.education?.forEach((item) => {
    add(item.school);
    add(item.degree);
    add(item.field);
  });
  resume.experience?.forEach((item) => {
    add(item.company);
    add(item.title);
    item.bullets?.forEach(add);
  });
  resume.projects?.forEach((item) => {
    add(item.name);
    add(item.description);
  });
  resume.skills?.forEach(add);
  resume.certifications?.forEach(add);
  resume.languages?.forEach(add);

  if (job) {
    add(job.company_name);
    add(job.role_title);
    add(job.location);
    add(job.employment_type);
    job.required_skills?.forEach(add);
    job.desired_skills?.forEach(add);
    job.keywords?.forEach(add);
    job.key_skills?.forEach(add);
  }

  return terms;
}

function extractPossibleEntities(content: string) {
  const multiWordCandidates = extractMatches(
    content,
    /\b[A-Z][A-Za-z0-9+.#-]*(?:\s+[A-Z][A-Za-z0-9+.#-]*){1,4}\b/g,
  );
  const contextualSingleWords = [...content.matchAll(/\b(?:at|from|for|with)\s+([A-Z][A-Za-z0-9+.#-]{2,})\b/g)]
    .map((match) => match[1]);
  const candidates = [...multiWordCandidates, ...contextualSingleWords];

  return candidates.filter((candidate) => {
    const trimmed = candidate.trim();
    if (COMMON_ENTITY_TERMS.has(trimmed)) return false;
    if (/^(Dear|Best|Subject|Attachments|Sincerely)\b/.test(trimmed)) return false;
    if (trimmed.split(/\s+/).every((word) => word.length <= 2)) return false;
    return true;
  });
}

function dedupeWarnings(warnings: GroundingWarning[]) {
  const seen = new Set<string>();
  return warnings.filter((warning) => {
    const key = `${warning.kind}:${normalizeTerm(warning.value)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
