import type { jsPDF } from "jspdf";
import type { DocumentType } from "@/lib/db/types";

type PrintableDocumentType = Extract<DocumentType, "tailored_resume" | "cover_letter">;
type FontStyle = "normal" | "bold" | "italic" | "bolditalic";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN_X = 44;
const BOTTOM_MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;
const BODY_SIZE = 10;
const BODY_LINE_HEIGHT = 12.4;
const BLUE = [31, 78, 121] as const;
const BLACK = [0, 0, 0] as const;

const SECTION_NAMES = new Set([
  "SUMMARY",
  "PROFILE",
  "OBJECTIVE",
  "EXPERIENCE",
  "WORK EXPERIENCE",
  "PROFESSIONAL EXPERIENCE",
  "EDUCATION",
  "SKILLS",
  "TECHNICAL SKILLS",
  "PROJECTS",
  "CERTIFICATIONS",
  "LANGUAGES",
  "PUBLICATIONS",
  "RESEARCH",
  "AWARDS",
  "VOLUNTEER",
  "VOLUNTEERING",
  "INTERESTS",
]);

const BULLET_RE = /^\s*(?:[-*•●▪◦‣–—\uf0b7])\s+(.*)$/u;
const DATE_RE = /\b(?:19|20)\d{2}\b|\b(?:present|current)\b/i;
const CONTACT_RE = /(?:@|https?:\/\/|www\.|linkedin\.com|github\.com|\+?\d[\d\s().-]{7,})/i;

const FONT_VARIANTS = [
  { query: "regular", file: "Caladea-Regular.ttf", style: "normal" },
  { query: "bold", file: "Caladea-Bold.ttf", style: "bold" },
  { query: "italic", file: "Caladea-Italic.ttf", style: "italic" },
  { query: "boldItalic", file: "Caladea-BoldItalic.ttf", style: "bolditalic" },
] as const;

let fontDataPromise: Promise<Map<string, string>> | null = null;

function stripInlineMarkdown(value: string): string {
  return value
    .replace(/^#{1,6}\s+/, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .trimEnd();
}

function normalizedHeading(value: string): string {
  return stripInlineMarkdown(value).trim().replace(/[:|]$/, "").toUpperCase();
}

export function isResumeSectionHeading(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 72) return false;
  if (/^##\s+/.test(trimmed)) return true;

  const clean = stripInlineMarkdown(trimmed).trim().replace(/[:|]$/, "");
  const normalized = normalizedHeading(trimmed);
  if (SECTION_NAMES.has(normalized)) return true;

  const letters = clean.replace(/[^\p{L}]/gu, "");
  return letters.length >= 4 && letters === letters.toUpperCase() && !CONTACT_RE.test(trimmed);
}

export function splitDocumentHeader(content: string): {
  headerLines: string[];
  bodyLines: string[];
} {
  const lines = content.replace(/\r\n?|\n/g, "\n").split("\n");
  let start = lines.findIndex((line) => line.trim());
  if (start < 0) return { headerLines: [], bodyLines: [] };

  const headerLines: string[] = [];
  let cursor = start;
  for (; cursor < lines.length && headerLines.length < 6; cursor += 1) {
    const line = lines[cursor];
    if (!line.trim()) break;
    // A run-on line this long is unsegmented body text, not a contact header —
    // render it as body instead of cramming it into the header row.
    if (line.trim().length > 160) break;
    if (headerLines.length > 0 && isResumeSectionHeading(line)) break;
    headerLines.push(stripInlineMarkdown(line).trim());
  }

  while (cursor < lines.length && !lines[cursor].trim()) cursor += 1;
  return {
    headerLines,
    bodyLines: lines.slice(cursor),
  };
}

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function loadFontData(): Promise<Map<string, string>> {
  if (!fontDataPromise) {
    fontDataPromise = Promise.all(
      FONT_VARIANTS.map(async ({ query, file }) => {
        const response = await fetch(`/api/document-font?variant=${query}`);
        if (!response.ok) throw new Error("Could not load the document font.");
        return [file, bufferToBase64(await response.arrayBuffer())] as const;
      }),
    ).then((entries) => new Map(entries));
  }
  return fontDataPromise;
}

async function registerFonts(doc: jsPDF) {
  const fonts = await loadFontData();
  for (const { file, style } of FONT_VARIANTS) {
    const data = fonts.get(file);
    if (!data) throw new Error(`Missing document font: ${file}`);
    doc.addFileToVFS(file, data);
    doc.addFont(file, "Caladea", style);
  }
}

function setFont(
  doc: jsPDF,
  style: FontStyle,
  size: number,
  color: readonly [number, number, number] = BLACK,
) {
  doc.setFont("Caladea", style);
  doc.setFontSize(size);
  doc.setTextColor(...color);
}

function headerTextParts(headerLines: string[]): { name: string; details: string } {
  const clean = headerLines.map((line) => line.trim()).filter(Boolean);
  if (clean.length === 0) return { name: "", details: "" };
  if (clean.length > 1) {
    return {
      name: clean[0],
      details: clean.slice(1).join(" | "),
    };
  }

  const tokens = clean[0].split(/\s+/);
  const name = tokens.slice(0, Math.min(2, tokens.length)).join(" ");
  return { name, details: tokens.slice(2).join(" ") };
}

function drawHeader(doc: jsPDF, headerLines: string[]): number {
  const { name, details } = headerTextParts(headerLines);
  const top = 41;
  const baseline = 57.5;
  const bottom = 65.5;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.75);
  doc.line(MARGIN_X, top, PAGE_WIDTH - MARGIN_X, top);

  setFont(doc, "bold", 11);
  doc.text(name, MARGIN_X, baseline);
  const nameWidth = name ? doc.getTextWidth(name) : 0;

  setFont(doc, "normal", 10.5);
  const separator = name && details ? "  " : "";
  const available = CONTENT_WIDTH - nameWidth - doc.getTextWidth(separator);
  let detailsSize = 10.5;
  while (detailsSize > 8.5 && doc.getTextWidth(details) > available) {
    detailsSize -= 0.25;
    doc.setFontSize(detailsSize);
  }
  if (details) doc.text(`${separator}${details}`, MARGIN_X + nameWidth, baseline);

  doc.setLineWidth(0.75);
  doc.line(MARGIN_X, bottom, PAGE_WIDTH - MARGIN_X, bottom);
  return 79;
}

function nextNonEmpty(lines: string[], index: number): string {
  for (let i = index + 1; i < lines.length; i += 1) {
    if (lines[i].trim()) return lines[i];
  }
  return "";
}

function looksLikeRoleLine(line: string, next: string): boolean {
  const clean = stripInlineMarkdown(line).trim();
  if (!clean || clean.length > 170 || BULLET_RE.test(clean)) return false;
  if (/^###\s+/.test(line.trim())) return true;
  if (BULLET_RE.test(next)) return true;
  return DATE_RE.test(clean) && /(?:\||\s[-–—]\s)/.test(clean);
}

function splitSkillRow(line: string): [string, string] | null {
  const match = line.trim().match(/^(.{3,34}?)(?:\t+|\s{2,})(.{8,})$/);
  if (match) {
    return [stripInlineMarkdown(match[1]).trim(), stripInlineMarkdown(match[2]).trim()];
  }

  const ampersandLabel = line.trim().match(
    /^((?:[A-Z][\p{L}/-]*\s+){0,3}[A-Z][\p{L}/-]*\s+&\s+[A-Z][\p{L}/-]*)\s+(.{8,})$/u,
  );
  if (!ampersandLabel) return null;
  return [
    stripInlineMarkdown(ampersandLabel[1]).trim(),
    stripInlineMarkdown(ampersandLabel[2]).trim(),
  ];
}

function drawResume(doc: jsPDF, content: string) {
  const { headerLines, bodyLines } = splitDocumentHeader(content);
  let y = drawHeader(doc, headerLines);
  let section = "";

  const newPage = () => {
    doc.addPage("letter", "portrait");
    y = drawHeader(doc, headerLines);
  };

  const ensure = (height: number) => {
    if (y + height > PAGE_HEIGHT - BOTTOM_MARGIN) newPage();
  };

  const drawWrapped = (
    text: string,
    options: {
      x?: number;
      width?: number;
      style?: FontStyle;
      size?: number;
      color?: readonly [number, number, number];
      lineHeight?: number;
      after?: number;
    } = {},
  ) => {
    const x = options.x ?? MARGIN_X;
    const width = options.width ?? CONTENT_WIDTH;
    const style = options.style ?? "normal";
    const size = options.size ?? BODY_SIZE;
    const color = options.color ?? BLACK;
    const lineHeight = options.lineHeight ?? BODY_LINE_HEIGHT;
    const after = options.after ?? 0;
    setFont(doc, style, size, color);
    const wrapped = doc.splitTextToSize(stripInlineMarkdown(text).trim(), width) as string[];
    ensure(wrapped.length * lineHeight + after);
    wrapped.forEach((part) => {
      doc.text(part, x, y);
      y += lineHeight;
    });
    y += after;
  };

  for (let index = 0; index < bodyLines.length; index += 1) {
    const raw = bodyLines[index];
    const trimmed = raw.trim();
    if (!trimmed) {
      y += 3.5;
      continue;
    }

    const repeatedHeader = headerLines.length > 0
      && stripInlineMarkdown(trimmed).trim() === headerLines[0].trim();
    if (repeatedHeader) {
      newPage();
      let headerOffset = 1;
      while (
        index + 1 < bodyLines.length
        && headerOffset < headerLines.length
        && stripInlineMarkdown(bodyLines[index + 1]).trim() === headerLines[headerOffset].trim()
      ) {
        index += 1;
        headerOffset += 1;
      }
      continue;
    }

    if (isResumeSectionHeading(trimmed)) {
      section = normalizedHeading(trimmed);
      if (y > 86) y += 6;
      ensure(26);
      drawWrapped(trimmed, {
        style: "bold",
        size: 11,
        color: BLUE,
        lineHeight: 13,
        after: 1,
      });
      continue;
    }

    const bullet = raw.match(BULLET_RE);
    if (bullet) {
      let bulletText = stripInlineMarkdown(bullet[1]).trim();
      while (index + 1 < bodyLines.length) {
        const candidate = bodyLines[index + 1];
        const cleanCandidate = stripInlineMarkdown(candidate).trim();
        if (
          !cleanCandidate
          || isResumeSectionHeading(candidate)
          || BULLET_RE.test(candidate)
          || cleanCandidate === headerLines[0]?.trim()
        ) {
          break;
        }

        const following = nextNonEmpty(bodyLines, index + 1);
        const isDefiniteRole = DATE_RE.test(cleanCandidate)
          || (BULLET_RE.test(following)
            && /(?:\||\s[-–—]\s)/.test(cleanCandidate)
            && !/[.!?]$/.test(cleanCandidate));
        if (isDefiniteRole) break;

        bulletText += ` ${cleanCandidate}`;
        index += 1;
      }

      setFont(doc, "normal", BODY_SIZE);
      const wrapped = doc.splitTextToSize(bulletText, CONTENT_WIDTH - 12) as string[];
      ensure(wrapped.length * BODY_LINE_HEIGHT + 1);
      doc.text("•", MARGIN_X, y);
      wrapped.forEach((part) => {
        doc.text(part, MARGIN_X + 10, y);
        y += BODY_LINE_HEIGHT;
      });
      y += 0.5;
      continue;
    }

    const skillRow = section.includes("SKILL") ? splitSkillRow(raw) : null;
    if (skillRow) {
      const [label, initialDescription] = skillRow;
      let description = initialDescription;
      while (index + 1 < bodyLines.length) {
        const candidate = bodyLines[index + 1];
        const cleanCandidate = stripInlineMarkdown(candidate).trim();
        if (
          !cleanCandidate
          || isResumeSectionHeading(candidate)
          || BULLET_RE.test(candidate)
          || splitSkillRow(candidate)
          || cleanCandidate === headerLines[0]?.trim()
        ) {
          break;
        }
        description += ` ${cleanCandidate}`;
        index += 1;
      }

      const labelWidth = 126;
      setFont(doc, "bold", 10.5);
      const labelLines = doc.splitTextToSize(label, labelWidth - 6) as string[];
      setFont(doc, "normal", BODY_SIZE);
      const descriptionLines = doc.splitTextToSize(description, CONTENT_WIDTH - labelWidth) as string[];
      const lineCount = Math.max(labelLines.length, descriptionLines.length);
      ensure(lineCount * BODY_LINE_HEIGHT + 1);
      setFont(doc, "bold", 10.5);
      labelLines.forEach((part, lineIndex) => doc.text(part, MARGIN_X, y + lineIndex * BODY_LINE_HEIGHT));
      setFont(doc, "normal", BODY_SIZE);
      descriptionLines.forEach((part, lineIndex) => doc.text(part, MARGIN_X + labelWidth, y + lineIndex * BODY_LINE_HEIGHT));
      y += lineCount * BODY_LINE_HEIGHT + 1;
      continue;
    }

    if (looksLikeRoleLine(raw, nextNonEmpty(bodyLines, index))) {
      ensure(25);
      drawWrapped(raw, {
        style: "bold",
        size: 10.5,
        color: BLUE,
        lineHeight: 12.8,
        after: 0.5,
      });
      continue;
    }

    const italic = /^\*[^*]+\*$/.test(trimmed) || /^_[^_]+_$/.test(trimmed);
    drawWrapped(raw, {
      style: italic ? "italic" : "normal",
      after: 1.5,
    });
  }
}

function isCoverSubheading(value: string): boolean {
  const clean = stripInlineMarkdown(value).trim();
  if (!clean || clean.length > 90 || /[.!?]$/.test(clean)) return false;
  const words = clean.split(/\s+/);
  const significantWords = words.filter((word) => !/^(?:and|or|of|the|for|to|in|with)$/i.test(word));
  return words.length >= 2
    && words.length <= 10
    && significantWords.length >= 2
    && significantWords.every((word) => /^[A-Z0-9]/.test(word));
}

function drawCoverLetter(doc: jsPDF, content: string) {
  const { headerLines, bodyLines } = splitDocumentHeader(content);
  let y = drawHeader(doc, headerLines);
  const blocks = bodyLines.join("\n").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  const newPage = () => {
    doc.addPage("letter", "portrait");
    y = drawHeader(doc, headerLines);
  };
  const ensure = (height: number) => {
    if (y + height > PAGE_HEIGHT - BOTTOM_MARGIN) newPage();
  };
  const drawWrapped = (text: string, style: FontStyle = "normal", size = 10, after = 7) => {
    setFont(doc, style, size);
    const wrapped = doc.splitTextToSize(stripInlineMarkdown(text).trim(), CONTENT_WIDTH) as string[];
    ensure(wrapped.length * BODY_LINE_HEIGHT + after);
    wrapped.forEach((part) => {
      doc.text(part, MARGIN_X, y);
      y += BODY_LINE_HEIGHT;
    });
    y += after;
  };

  blocks.forEach((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const first = stripInlineMarkdown(lines[0]).trim();

    if (index === 0 && /\b(?:19|20)\d{2}\b/.test(first)) {
      drawWrapped(lines.join(" "), "normal", 10.5, 9);
      return;
    }
    if (/^Re\s*:/i.test(first)) {
      drawWrapped(lines.join(" "), "bold", 10.5, 8);
      return;
    }
    if (/^Dear\b/i.test(first)) {
      drawWrapped(lines.join(" "), "normal", 10.5, 8);
      return;
    }
    if (/^(Sincerely|Best regards|Kind regards|Regards|Respectfully)[,.]?$/i.test(first)) {
      lines.forEach((line, lineIndex) => drawWrapped(line, lineIndex === 0 ? "normal" : "normal", 10.5, lineIndex === lines.length - 1 ? 0 : 1));
      return;
    }
    if (index === 1 && lines.length <= 4) {
      lines.forEach((line, lineIndex) => drawWrapped(line, lineIndex === 0 ? "bold" : "normal", 10.5, lineIndex === lines.length - 1 ? 9 : 0));
      return;
    }
    if (lines.length === 1 && isCoverSubheading(first)) {
      drawWrapped(first, "bold", 10.5, 2);
      return;
    }
    drawWrapped(lines.join(" "), "normal", 10, 7);
  });
}

export async function createApplicationPdf(
  content: string,
  documentType: PrintableDocumentType,
  title = "Application document",
): Promise<Blob> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const doc = new JsPdf({ orientation: "portrait", unit: "pt", format: "letter", putOnlyUsedFonts: true });
  await registerFonts(doc);

  if (documentType === "cover_letter") drawCoverLetter(doc, content);
  else drawResume(doc, content);

  doc.setProperties({
    title,
    subject: documentType === "cover_letter" ? "Cover Letter" : "Tailored Resume",
    creator: "HireMe",
  });
  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
