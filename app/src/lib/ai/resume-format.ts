export interface ResumeReplacementCandidate {
  id: string;
  text: string;
  kind: "bullet" | "prose";
  section: string;
  context?: string;
  maxCharacters: number;
}

export interface AppliedResumeReplacement {
  id: string;
  originalText: string;
  replacementText: string;
}

export interface ResumeFormatTemplate {
  candidates: ResumeReplacementCandidate[];
}

export interface CoverLetterDraft {
  date: string;
  recipient: string[];
  subject?: string;
  greeting: string;
  opening?: string;
  sections?: Array<{ heading: string; paragraph: string }>;
  finalParagraph?: string;
  paragraphs?: string[];
  closing: string;
  signature: string;
}

const BULLET_RE = /^(\s*(?:(?:[-*\u2022\u25cf\u25aa\u25e6\u2023\u2013\u2014\uf0b7])|(?:\d+[.)]))\s+)(.*)$/u;
const CONTACT_RE = /(?:@|https?:\/\/|www\.|linkedin\.com|github\.com|\+?\d[\d\s().-]{7,})/i;
const DATE_RE = /\b(?:19|20)\d{2}\b|\b(?:present|current)\b/i;
const SECTION_RE = /^(?:summary|profile|objective|experience|work experience|professional experience|education|skills|technical skills|projects|certifications|languages|publications|research|awards|volunteer(?:ing)?|interests)$/i;
const PROTECTED_DETAIL_SECTIONS = new Set(["education"]);
const SKILLS_SECTIONS = new Set(["skills", "technical skills"]);

function splitLines(value: string): string[] {
  return value.split(/\r\n|\n|\r/);
}

function newlineFor(value: string): string {
  if (value.includes("\r\n")) return "\r\n";
  if (value.includes("\r")) return "\r";
  return "\n";
}

export function hasUsableResumeLineStructure(rawResumeText: string): boolean {
  const trimmed = rawResumeText.trim();
  if (!trimmed) return false;
  const lines = splitLines(trimmed).map((line) => line.trim()).filter(Boolean);
  if (lines.length === 1) return trimmed.length <= MAX_HEADER_LINE_LENGTH;
  return Math.max(...lines.map((line) => line.length)) <= 500;
}

function normalizedWords(value: string): string[] {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}@.+]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function stripAccidentalResumePrefixFromCoverLetter(
  content: string,
  rawResumeText: string,
): string {
  const lines = splitLines(content);
  const coverStart = lines.findIndex((line) => (
    /^(?:(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},\s+\d{4}|re\s*:|dear\b|to whom\b)/i.test(line.trim())
  ));
  if (coverStart <= 0) return content;

  const prefix = lines.slice(0, coverStart).join(" ").trim();
  if (prefix.length < 160) return content;
  const prefixWords = normalizedWords(prefix).slice(0, 80);
  const sourceWords = new Set(normalizedWords(rawResumeText).slice(0, 160));
  if (!prefixWords.length || sourceWords.size < 8) return content;
  const shared = prefixWords.filter((word) => sourceWords.has(word)).length;
  if (shared / prefixWords.length < 0.65) return content;

  return lines.slice(coverStart).join(newlineFor(content)).trimStart();
}

function contentWithoutPrefix(line: string): string {
  const bullet = line.match(BULLET_RE);
  if (bullet) return bullet[2];
  return line.trimStart();
}

function factualAnchors(value: string): string[] {
  return value.match(
    /\b(?:[A-Z]{2,}[A-Za-z0-9+.#/-]*|[A-Z][a-z]+[A-Z][A-Za-z0-9+.#/-]*|\d+(?:[.,]\d+)?%?)\b/g,
  ) ?? [];
}

function introducesUnsupportedFactualAnchor(evidence: string, replacement: string): boolean {
  const originalAnchors = new Set(factualAnchors(evidence).map((value) => value.toLocaleLowerCase()));
  return factualAnchors(replacement).some(
    (value) => !originalAnchors.has(value.toLocaleLowerCase()),
  );
}

function canUseResumeWideEvidence(section: string): boolean {
  return section === "summary"
    || section === "profile"
    || section === "objective"
    || section.includes("summary of qualifications");
}

function isEditableSkillsLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  const detail = trimmed.includes(":") ? trimmed.slice(trimmed.indexOf(":") + 1) : trimmed;
  return detail.split(/[,;|]/).filter((item) => item.trim()).length >= 2;
}

function skillCategoryPrefix(value: string): string | null {
  return value.trim().match(/^([^:]{1,64}:)/)?.[1] ?? null;
}

function normalizedSkillItems(value: string): string[] {
  const detail = value.includes(":") ? value.slice(value.indexOf(":") + 1) : value;
  return detail
    .split(/[,;|]/)
    .map((item) => item.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function looksLikeHeading(line: string): boolean {
  const trimmed = line.trim().replace(/[:|]$/, "");
  if (!trimmed || trimmed.length > 64) return false;
  if (SECTION_RE.test(trimmed)) return true;

  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function sectionNameFromLine(line: string): string | null {
  const trimmed = line.trim().replace(/[:|]$/, "");
  if (SECTION_RE.test(trimmed)) return trimmed.toLocaleLowerCase();
  const inlineSkills = line.trim().match(/^(technical skills|skills)\s*:/i);
  if (inlineSkills?.[1]) return inlineSkills[1].toLocaleLowerCase();
  return looksLikeHeading(line) ? trimmed.toLocaleLowerCase() : null;
}

function isEditableLine(line: string, lineIndex: number, nonEmptyIndex: number): boolean {
  const trimmed = line.trim();
  if (!trimmed || nonEmptyIndex < 3 || looksLikeHeading(trimmed)) return false;
  if (CONTACT_RE.test(trimmed)) return false;

  const bullet = line.match(BULLET_RE);
  if (bullet) return bullet[2].trim().length >= 8;

  // Long prose is usually a summary or a project/experience description. Keep
  // short employer/title/date rows immutable so the model cannot restructure them.
  return trimmed.length >= 56 && !DATE_RE.test(trimmed) && lineIndex > 2;
}

export function createResumeFormatTemplate(rawResumeText: string): ResumeFormatTemplate {
  const lines = splitLines(rawResumeText);
  const candidates: ResumeReplacementCandidate[] = [];
  let nonEmptyIndex = 0;
  let currentSection = "";
  let currentContext = "";

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();
    if (!trimmed) {
      currentContext = "";
      return;
    }
    nonEmptyIndex += 1;
    const inlineSkills = trimmed.match(/^(technical skills|skills)\s*:\s*\S/i);
    if (inlineSkills?.[1]) {
      currentSection = inlineSkills[1].toLocaleLowerCase();
      currentContext = "";
      candidates.push({
        id: `L${String(lineIndex + 1).padStart(4, "0")}`,
        text: trimmed,
        kind: "prose",
        section: currentSection,
        maxCharacters: trimmed.length,
      });
      return;
    }
    const nextSection = sectionNameFromLine(line);
    if (nextSection) {
      currentSection = nextSection;
      currentContext = "";
      return;
    }
    if (PROTECTED_DETAIL_SECTIONS.has(currentSection)) return;
    const editableSkillsLine = SKILLS_SECTIONS.has(currentSection) && isEditableSkillsLine(line);
    if (!editableSkillsLine && !isEditableLine(line, lineIndex, nonEmptyIndex)) {
      if (!CONTACT_RE.test(trimmed) && trimmed.length <= 180) currentContext = trimmed;
      return;
    }
    const text = contentWithoutPrefix(line).trim();
    candidates.push({
      id: `L${String(lineIndex + 1).padStart(4, "0")}`,
      text,
      kind: BULLET_RE.test(line) ? "bullet" : "prose",
      section: currentSection || "resume body",
      ...(currentContext ? { context: currentContext } : {}),
      maxCharacters: text.length,
    });
  });

  return { candidates };
}

export function applyResumeReplacements(
  rawResumeText: string,
  replacements: Record<string, unknown> | null | undefined,
): string {
  if (!replacements) return rawResumeText;

  const lines = splitLines(rawResumeText);
  const allowed = new Map(
    createResumeFormatTemplate(rawResumeText).candidates.map((candidate) => [candidate.id, candidate]),
  );

  for (const [id, replacementValue] of Object.entries(replacements)) {
    const candidate = allowed.get(id);
    if (!candidate || typeof replacementValue !== "string") continue;
    const replacement = replacementValue.trim();
    if (!replacement || /[\r\n]/.test(replacement)) continue;

    const lineIndex = Number(id.slice(1)) - 1;
    const original = lines[lineIndex];
    if (original === undefined) continue;
    const factualEvidence = canUseResumeWideEvidence(candidate.section)
      ? rawResumeText
      : candidate.text;
    if (introducesUnsupportedFactualAnchor(factualEvidence, replacement)) continue;

    if (SKILLS_SECTIONS.has(candidate.section)) {
      const originalCategory = skillCategoryPrefix(candidate.text);
      if (originalCategory && skillCategoryPrefix(replacement) !== originalCategory) continue;
      const originalSkills = new Set(normalizedSkillItems(candidate.text));
      if (normalizedSkillItems(replacement).some((skill) => !originalSkills.has(skill))) continue;
    }

    const bullet = original.match(BULLET_RE);
    if (bullet) {
      const replacementBody = replacement.replace(BULLET_RE, "$2").trim();
      if (replacementBody && replacementBody.length <= candidate.maxCharacters) {
        lines[lineIndex] = `${bullet[1]}${replacementBody}`;
      }
      continue;
    }

    if (replacement.length > candidate.maxCharacters) continue;

    const leadingWhitespace = original.match(/^\s*/)?.[0] ?? "";
    lines[lineIndex] = `${leadingWhitespace}${replacement}`;
  }

  return lines.join(newlineFor(rawResumeText));
}

export function minimumResumeTailoringChanges(candidateCount: number): number {
  if (candidateCount <= 0) return 0;
  if (candidateCount >= 10) return 3;
  if (candidateCount >= 4) return 2;
  return 1;
}

export function diffResumeReplacements(
  rawResumeText: string,
  tailoredResumeText: string,
): AppliedResumeReplacement[] {
  const sourceLines = splitLines(rawResumeText);
  const tailoredLines = splitLines(tailoredResumeText);
  if (sourceLines.length !== tailoredLines.length) return [];

  return createResumeFormatTemplate(rawResumeText).candidates.flatMap((candidate) => {
    const lineIndex = Number(candidate.id.slice(1)) - 1;
    const tailoredLine = tailoredLines[lineIndex];
    if (tailoredLine === undefined) return [];
    const replacementText = contentWithoutPrefix(tailoredLine).trim();
    if (!replacementText || replacementText === candidate.text.trim()) return [];
    return [{
      id: candidate.id,
      originalText: candidate.text.trim(),
      replacementText,
    }];
  });
}

export function applyValidatedResumeReplacements(
  rawResumeText: string,
  replacements: Record<string, unknown> | null | undefined,
  minimumChanges: number,
): string {
  const tailored = applyResumeReplacements(rawResumeText, replacements);
  const appliedChanges = diffResumeReplacements(rawResumeText, tailored).length;
  if (appliedChanges < minimumChanges) {
    throw new Error("Resume tailoring did not produce enough supported changes.");
  }
  return tailored;
}

// Real contact-header lines are short; anything longer is unsegmented body text
// (e.g. legacy extractions that collapsed the whole resume into one line).
const MAX_HEADER_LINE_LENGTH = 160;

export function extractResumeHeader(rawResumeText: string): string[] {
  if (!hasUsableResumeLineStructure(rawResumeText)) return [];
  const lines = splitLines(rawResumeText);
  const start = lines.findIndex((line) => line.trim());
  if (start < 0) return [];

  const header: string[] = [];
  for (let i = start; i < lines.length && header.length < 6; i += 1) {
    const line = lines[i];
    if (!line.trim()) break;
    if (line.trim().length > MAX_HEADER_LINE_LENGTH) break;
    if (header.length > 0 && looksLikeHeading(line)) break;
    header.push(line.trimEnd());
  }
  return header;
}

function cleanSingleLine(value: unknown): string {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim() : "";
}

export function renderCoverLetterWithResumeFormat(
  rawResumeText: string,
  draft: CoverLetterDraft,
): string {
  const newline = newlineFor(rawResumeText);
  const header = extractResumeHeader(rawResumeText);
  const recipient = Array.isArray(draft.recipient)
    ? draft.recipient.map(cleanSingleLine).filter(Boolean).slice(0, 4)
    : [];
  const legacyParagraphs = Array.isArray(draft.paragraphs)
    ? draft.paragraphs.map(cleanSingleLine).filter(Boolean).slice(0, 5)
    : [];
  const sections = Array.isArray(draft.sections)
    ? draft.sections
      .map((section) => ({
        heading: cleanSingleLine(section?.heading),
        paragraph: cleanSingleLine(section?.paragraph),
      }))
      .filter((section) => section.heading && section.paragraph)
      .slice(0, 4)
    : [];

  const blocks: string[] = [];
  if (header.length) blocks.push(header.join(newline));
  const date = cleanSingleLine(draft.date);
  if (date) blocks.push(date);
  if (recipient.length) blocks.push(recipient.join(newline));
  const subject = cleanSingleLine(draft.subject);
  if (subject) blocks.push(subject);
  const greeting = cleanSingleLine(draft.greeting);
  if (greeting) blocks.push(greeting);
  const opening = cleanSingleLine(draft.opening);
  const finalParagraph = cleanSingleLine(draft.finalParagraph);
  if (opening || sections.length || finalParagraph) {
    if (opening) blocks.push(opening);
    for (const section of sections) {
      blocks.push(section.heading, section.paragraph);
    }
    if (finalParagraph) blocks.push(finalParagraph);
  } else {
    blocks.push(...legacyParagraphs);
  }

  const closing = cleanSingleLine(draft.closing) || "Sincerely,";
  const signature = cleanSingleLine(draft.signature) || header[0]?.trim() || "";
  blocks.push([closing, signature].filter(Boolean).join(newline));

  return blocks.filter(Boolean).join(`${newline}${newline}`);
}
