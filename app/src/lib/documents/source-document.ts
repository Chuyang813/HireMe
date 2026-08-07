import { createApplicationPdf } from "./application-pdf";
import {
  diffResumeReplacements,
  extractResumeHeader,
  hasUsableResumeLineStructure,
  stripAccidentalResumePrefixFromCoverLetter,
} from "@/lib/ai/resume-format";

export type ResumeSourceType = "pdf" | "docx" | "txt";
export type PrintableDocumentType = "tailored_resume" | "cover_letter";

export const SOURCE_DOCUMENT_LOAD_ERROR = "Could not load the uploaded document/PDF.";

export interface SourceFormattedArtifact {
  previewType: "pdf" | "docx";
  sourceType: ResumeSourceType;
  pdfBlob?: Blob;
  docxBlob?: Blob;
}

type PdfTextItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName: string;
  hasEOL?: boolean;
};

type PdfTextStyle = {
  fontFamily?: string;
  ascent?: number;
  descent?: number;
};

type PositionedTextItem = {
  text: string;
  x: number;
  width: number;
  baseline: number;
  height: number;
  fontName: string;
  fontFamily: string;
};

type PdfTextLine = {
  text: string;
  items: PositionedTextItem[];
  x: number;
  right: number;
  top: number;
  bottom: number;
  baseline: number;
  height: number;
  fontName: string;
  fontFamily: string;
};

type RenderedPdfPage = {
  canvas: HTMLCanvasElement;
  lines: PdfTextLine[];
  widthPt: number;
  heightPt: number;
  scale: number;
};

const WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const XML_NS = "http://www.w3.org/XML/1998/namespace";
const BULLET_ONLY_RE = /^\s*(?:(?:[-*\u2022\u25cf\u25aa\u25e6\u2023\u2013\u2014\uf0b7])|(?:\d+[.)]))\s*$/u;
const INLINE_BULLET_RE = /^(\s*(?:(?:[-*\u2022\u25cf\u25aa\u25e6\u2023\u2013\u2014\uf0b7])|(?:\d+[.)]))\s+)/u;
const COVER_STOP_WORDS = /^(?:and|or|of|the|for|to|in|with)$/i;

function normalizeMatchText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2022\u25cf\u25aa\u25e6\u2023\u2013\u2014\uf0b7]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function sourceTextMatchScore(left: string, right: string): number {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    return Math.min(a.length, b.length) / Math.max(a.length, b.length) * 0.96;
  }

  const aTokens = new Set(a.split(" ").filter(Boolean));
  const bTokens = new Set(b.split(" ").filter(Boolean));
  const shared = [...aTokens].filter((token) => bTokens.has(token)).length;
  if (!shared) return 0;
  return (2 * shared) / (aTokens.size + bTokens.size);
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function percentile(values: number[], ratio: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))];
}

function modeByWeight<T>(values: Array<{ value: T; weight: number }>, fallback: T): T {
  const totals = new Map<T, number>();
  values.forEach(({ value, weight }) => totals.set(value, (totals.get(value) ?? 0) + weight));
  let winner = fallback;
  let winnerWeight = -1;
  totals.forEach((weight, value) => {
    if (weight > winnerWeight) {
      winner = value;
      winnerWeight = weight;
    }
  });
  return winner;
}

function isPdfTextItem(value: unknown): value is PdfTextItem {
  return Boolean(value && typeof value === "object" && "str" in value);
}

async function loadPdfPages(bytes: ArrayBuffer): Promise<RenderedPdfPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "/api/pdf-worker";
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
  const pdf = await loadingTask.promise;
  const pages: RenderedPdfPage[] = [];
  const scale = 2;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const unscaledViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas rendering is unavailable.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;

    const textContent = await page.getTextContent();
    const styles = textContent.styles as Record<string, PdfTextStyle>;
    const textItems = textContent.items.filter(isPdfTextItem) as unknown as PdfTextItem[];
    const positioned = textItems.map((item) => {
      const transform = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.max(1, Math.hypot(transform[2], transform[3]) || item.height * scale);
      const style = styles[item.fontName] ?? {};
      return {
        text: item.str,
        x: transform[4],
        width: Math.max(0, item.width * scale),
        baseline: transform[5],
        height,
        fontName: item.fontName,
        fontFamily: style.fontFamily ?? item.fontName,
      } satisfies PositionedTextItem;
    }).filter((item) => item.text.trim());

    const grouped: PositionedTextItem[][] = [];
    for (const item of positioned.sort((a, b) => a.baseline - b.baseline || a.x - b.x)) {
      const existing = grouped.find((group) => (
        Math.abs(group[0].baseline - item.baseline) <= Math.max(2.5, item.height * 0.3)
      ));
      if (existing) existing.push(item);
      else grouped.push([item]);
    }

    const lines = grouped.map((group) => {
      const items = group.sort((a, b) => a.x - b.x);
      const textParts: string[] = [];
      items.forEach((item, index) => {
        const previous = items[index - 1];
        const gap = previous ? item.x - (previous.x + previous.width) : 0;
        if (previous && gap > Math.max(1.5, item.height * 0.15)) textParts.push(" ");
        textParts.push(item.text);
      });
      const x = Math.min(...items.map((item) => item.x));
      const right = Math.max(...items.map((item) => item.x + item.width));
      const height = median(items.map((item) => item.height)) || 10 * scale;
      const baseline = median(items.map((item) => item.baseline));
      return {
        text: textParts.join("").replace(/\s+/g, " ").trim(),
        items,
        x,
        right,
        top: baseline - height * 0.92,
        bottom: baseline + height * 0.24,
        baseline,
        height,
        fontName: modeByWeight(
          items.map((item) => ({ value: item.fontName, weight: item.text.length })),
          items[0].fontName,
        ),
        fontFamily: modeByWeight(
          items.map((item) => ({ value: item.fontFamily, weight: item.text.length })),
          items[0].fontFamily,
        ),
      } satisfies PdfTextLine;
    }).sort((a, b) => a.top - b.top || a.x - b.x);

    pages.push({
      canvas,
      lines,
      widthPt: unscaledViewport.width,
      heightPt: unscaledViewport.height,
      scale,
    });
  }

  return pages;
}

function sampleBackground(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
): [number, number, number] {
  const canvas = context.canvas;
  const samples: Array<[number, number, number]> = [];
  const points = [
    [x, y - 2], [x + width / 2, y - 2], [x + width, y - 2],
    [x, y + height + 2], [x + width / 2, y + height + 2], [x + width, y + height + 2],
  ];
  points.forEach(([sampleX, sampleY]) => {
    const px = Math.min(canvas.width - 1, Math.max(0, Math.round(sampleX)));
    const py = Math.min(canvas.height - 1, Math.max(0, Math.round(sampleY)));
    const data = context.getImageData(px, py, 1, 1).data;
    samples.push([data[0], data[1], data[2]]);
  });
  return [
    Math.round(median(samples.map((sample) => sample[0]))),
    Math.round(median(samples.map((sample) => sample[1]))),
    Math.round(median(samples.map((sample) => sample[2]))),
  ];
}

function sampleForeground(
  context: CanvasRenderingContext2D,
  box: { x: number; top: number; right: number; bottom: number },
  background: [number, number, number],
): [number, number, number] {
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.top));
  const width = Math.max(1, Math.min(context.canvas.width - x, Math.ceil(box.right - box.x)));
  const height = Math.max(1, Math.min(context.canvas.height - y, Math.ceil(box.bottom - box.top)));
  const data = context.getImageData(x, y, width, height).data;
  const colors: Array<[number, number, number]> = [];
  for (let index = 0; index < data.length; index += 16) {
    const color: [number, number, number] = [data[index], data[index + 1], data[index + 2]];
    const distance = Math.abs(color[0] - background[0])
      + Math.abs(color[1] - background[1])
      + Math.abs(color[2] - background[2]);
    if (distance > 90) colors.push(color);
  }
  if (!colors.length) return [0, 0, 0];
  colors.sort((a, b) => (a[0] + a[1] + a[2]) - (b[0] + b[1] + b[2]));
  const selected = colors.slice(0, Math.max(1, Math.ceil(colors.length * 0.35)));
  return [
    Math.round(median(selected.map((color) => color[0]))),
    Math.round(median(selected.map((color) => color[1]))),
    Math.round(median(selected.map((color) => color[2]))),
  ];
}

function findBestLineRange(
  pages: RenderedPdfPage[],
  originalText: string,
  used: Set<string>,
): { pageIndex: number; start: number; end: number; score: number } | null {
  let best: { pageIndex: number; start: number; end: number; score: number } | null = null;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    for (let start = 0; start < page.lines.length; start += 1) {
      for (let end = start; end < Math.min(page.lines.length, start + 4); end += 1) {
        const lineKeys = Array.from(
          { length: end - start + 1 },
          (_, offset) => `${pageIndex}:${start + offset}`,
        );
        if (lineKeys.some((key) => used.has(key))) continue;
        const text = page.lines.slice(start, end + 1).map((line) => line.text).join(" ");
        const score = sourceTextMatchScore(text, originalText);
        if (!best || score > best.score) best = { pageIndex, start, end, score };
      }
    }
  }
  return best && best.score >= 0.82 ? best : null;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let line = words[0];
  for (const word of words.slice(1)) {
    const candidate = `${line} ${word}`;
    if (context.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

export function restoreInlineBulletPrefix(
  sourceLine: string,
  replacementText: string,
): string {
  const sourcePrefix = sourceLine.match(INLINE_BULLET_RE)?.[1];
  if (!sourcePrefix || INLINE_BULLET_RE.test(replacementText)) return replacementText;
  return `${sourcePrefix}${replacementText}`;
}

function paintReplacement(
  page: RenderedPdfPage,
  lines: PdfTextLine[],
  replacementText: string,
): boolean {
  const context = page.canvas.getContext("2d");
  if (!context || !lines.length) return false;

  const firstLineItems = lines[0].items;
  const markerItems = firstLineItems.filter((item) => BULLET_ONLY_RE.test(item.text));
  const contentItems = markerItems.length
    ? [...firstLineItems.filter((item) => !markerItems.includes(item)), ...lines.slice(1).flatMap((line) => line.items)]
    : lines.flatMap((line) => line.items);
  const x = Math.min(...contentItems.map((item) => item.x));
  const right = Math.max(...contentItems.map((item) => item.x + item.width));
  const top = Math.min(...lines.map((line) => line.top));
  const bottom = Math.max(...lines.map((line) => line.bottom));
  const width = Math.max(12, right - x);
  const height = Math.max(lines[0].height, bottom - top);
  const background = sampleBackground(context, x, top, width, height);
  const foreground = sampleForeground(context, { x, top, right, bottom }, background);
  const drawableText = markerItems.length
    ? replacementText
    : restoreInlineBulletPrefix(lines[0].text, replacementText);

  const sourceFontSize = median(lines.map((line) => line.height)) || 10 * page.scale;
  const fontName = lines[0].fontName || lines[0].fontFamily || "serif";
  context.save();
  let fitted: { fontSize: number; lineHeight: number; wrapped: string[] } | null = null;
  for (const scale of [1, 0.97, 0.94, 0.91, 0.88, 0.85]) {
    const fontSize = sourceFontSize * scale;
    const lineHeight = fontSize * 1.18;
    context.font = `${fontSize}px "${fontName}", "${lines[0].fontFamily}", serif`;
    const wrapped = wrapCanvasText(context, drawableText, width);
    const availableHeight = Math.max(height, lines.length * sourceFontSize * 1.18) + 2;
    if (
      wrapped.length
      && wrapped.length <= lines.length
      && wrapped.length * lineHeight <= availableHeight
    ) {
      fitted = { fontSize, lineHeight, wrapped };
      break;
    }
  }
  if (!fitted) {
    context.restore();
    return false;
  }

  context.font = `${fitted.fontSize}px "${fontName}", "${lines[0].fontFamily}", serif`;
  context.fillStyle = `rgb(${background.join(",")})`;
  // Keep the erase rectangle inside the source glyph bounds so adjacent rules,
  // borders, and section dividers remain untouched.
  context.fillRect(x - 1, top, width + 2, height);
  context.fillStyle = `rgb(${foreground.join(",")})`;
  context.textBaseline = "alphabetic";
  const firstBaseline = top + fitted.fontSize * 0.92;
  fitted.wrapped.forEach((line, index) => (
    context.fillText(line, x, firstBaseline + index * fitted.lineHeight)
  ));
  context.restore();
  return true;
}

function pdfSearchLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .flatMap((line) => line.trim().match(/.{1,110}/gu) ?? [])
    .filter(Boolean);
}

async function canvasesToPdf(
  pages: RenderedPdfPage[],
  title: string,
  searchableText: string,
): Promise<Blob> {
  const { jsPDF: JsPdf } = await import("jspdf");
  const first = pages[0];
  if (!first) throw new Error("The source PDF has no pages.");
  const doc = new JsPdf({
    orientation: first.widthPt > first.heightPt ? "landscape" : "portrait",
    unit: "pt",
    format: [first.widthPt, first.heightPt],
    compress: true,
  });

  const searchLines = pdfSearchLines(searchableText);
  const linesPerPage = Math.max(1, Math.ceil(searchLines.length / pages.length));
  pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage(
        [page.widthPt, page.heightPt],
        page.widthPt > page.heightPt ? "landscape" : "portrait",
      );
    }
    doc.addImage(
      page.canvas.toDataURL("image/jpeg", 0.97),
      "JPEG",
      0,
      0,
      page.widthPt,
      page.heightPt,
      undefined,
      "FAST",
    );
    const pageSearchLines = searchLines.slice(index * linesPerPage, (index + 1) * linesPerPage);
    if (pageSearchLines.length) {
      // The page image is the visual source of truth. This invisible layer keeps
      // the tailored content selectable and available to ATS/PDF text extractors.
      doc.setFont("helvetica", "normal");
      doc.setFontSize(2);
      doc.text(pageSearchLines, 2, 3, {
        lineHeightFactor: 1,
        renderingMode: "invisible",
      });
    }
  });
  doc.setProperties({ title, creator: "HireMe" });
  return doc.output("blob");
}

async function createTailoredPdfFromSource(
  sourceBytes: ArrayBuffer,
  rawSourceText: string,
  content: string,
  title: string,
): Promise<Blob> {
  const pages = await loadPdfPages(sourceBytes);
  const replacements = diffResumeReplacements(rawSourceText, content);
  const used = new Set<string>();
  replacements.forEach((replacement) => {
    const match = findBestLineRange(pages, replacement.originalText, used);
    if (!match) return;
    const applied = paintReplacement(
      pages[match.pageIndex],
      pages[match.pageIndex].lines.slice(match.start, match.end + 1),
      replacement.replacementText,
    );
    if (!applied) return;
    for (let lineIndex = match.start; lineIndex <= match.end; lineIndex += 1) {
      used.add(`${match.pageIndex}:${lineIndex}`);
    }
  });
  return canvasesToPdf(pages, title, content);
}

function eraseLine(context: CanvasRenderingContext2D, line: PdfTextLine) {
  const width = Math.max(1, line.right - line.x);
  const height = Math.max(1, line.bottom - line.top);
  const background = sampleBackground(context, line.x, line.top, width, height);
  context.fillStyle = `rgb(${background.join(",")})`;
  context.fillRect(line.x - 2, line.top - 2, width + 4, height + 4);
}

function isCoverSubheading(value: string): boolean {
  const clean = value.trim();
  if (!clean || clean.length > 90 || /[.!?]$/.test(clean)) return false;
  const words = clean.split(/\s+/);
  const significant = words.filter((word) => !COVER_STOP_WORDS.test(word));
  return words.length >= 2
    && words.length <= 10
    && significant.length >= 2
    && significant.every((word) => /^[A-Z0-9]/.test(word));
}

function cloneCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext("2d")?.drawImage(source, 0, 0);
  return canvas;
}

async function createCoverPdfFromSource(
  sourceBytes: ArrayBuffer,
  rawSourceText: string,
  content: string,
  title: string,
): Promise<Blob> {
  const sourcePages = await loadPdfPages(sourceBytes);
  const firstPage = sourcePages[0];
  if (!firstPage) throw new Error("The source PDF has no pages.");
  const headerText = extractResumeHeader(rawSourceText).join(" ");
  const headerMatch = findBestLineRange([firstPage], headerText, new Set());
  const headerBottom = headerMatch
    ? firstPage.lines[headerMatch.end].bottom + 10 * firstPage.scale
    : Math.min(firstPage.canvas.height * 0.18, 120 * firstPage.scale);

  const template = cloneCanvas(firstPage.canvas);
  const templateContext = template.getContext("2d");
  if (!templateContext) throw new Error("Canvas rendering is unavailable.");
  firstPage.lines.filter((line) => line.top > headerBottom).forEach((line) => eraseLine(templateContext, line));

  const bodyLines = firstPage.lines.filter((line) => line.top > headerBottom);
  const bodyFontSize = median(bodyLines.map((line) => line.height)) || 10 * firstPage.scale;
  const bodyFont = modeByWeight(
    bodyLines.map((line) => ({ value: line.fontName, weight: line.text.length })),
    bodyLines[0]?.fontName ?? "serif",
  );
  const bodyFamily = modeByWeight(
    bodyLines.map((line) => ({ value: line.fontFamily, weight: line.text.length })),
    bodyLines[0]?.fontFamily ?? "serif",
  );
  const left = percentile(bodyLines.map((line) => line.x), 0.15) || 44 * firstPage.scale;
  const right = percentile(bodyLines.map((line) => line.right), 0.9) || firstPage.canvas.width - 44 * firstPage.scale;
  const maxWidth = Math.max(200, right - left);
  const sampleLine = bodyLines.find((line) => line.fontName === bodyFont) ?? bodyLines[0];
  const context = firstPage.canvas.getContext("2d");
  const background: [number, number, number] = [255, 255, 255];
  const bodyColor = context && sampleLine
    ? sampleForeground(context, sampleLine, background)
    : [0, 0, 0] as [number, number, number];

  const { bodyLines: coverBodyLines } = (() => {
    const normalized = content.replace(/\r\n?/g, "\n").split("\n");
    let cursor = normalized.findIndex((line) => !line.trim());
    if (cursor < 0) cursor = 0;
    while (cursor < normalized.length && !normalized[cursor].trim()) cursor += 1;
    return { bodyLines: normalized.slice(cursor) };
  })();
  const blocks = coverBodyLines.join("\n").split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

  const outputPages: RenderedPdfPage[] = [];
  let canvas = cloneCanvas(template);
  const initialDrawContext = canvas.getContext("2d");
  if (!initialDrawContext) throw new Error("Canvas rendering is unavailable.");
  let drawContext: CanvasRenderingContext2D = initialDrawContext;
  let y = headerBottom + bodyFontSize * 1.15;
  const bottom = canvas.height - 42 * firstPage.scale;
  const lineHeight = bodyFontSize * 1.22;

  const pushPage = () => {
    outputPages.push({ ...firstPage, canvas, lines: [] });
    canvas = cloneCanvas(template);
    const nextContext = canvas.getContext("2d");
    if (!nextContext) throw new Error("Canvas rendering is unavailable.");
    drawContext = nextContext;
    y = headerBottom + bodyFontSize * 1.15;
  };

  blocks.forEach((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const first = lines[0] ?? "";
    const bold = /^Re\s*:/i.test(first)
      || isCoverSubheading(first)
      || (index === 1 && lines.length <= 4);
    const size = bodyFontSize * (bold ? 1.02 : 1);
    drawContext.font = `${bold ? "bold " : ""}${size}px "${bodyFont}", "${bodyFamily}", serif`;
    const wrapped = lines.flatMap((line) => wrapCanvasText(drawContext, line, maxWidth));
    wrapped.forEach((line) => {
      if (y + lineHeight > bottom) pushPage();
      drawContext.font = `${bold ? "bold " : ""}${size}px "${bodyFont}", "${bodyFamily}", serif`;
      drawContext.fillStyle = `rgb(${bodyColor.join(",")})`;
      drawContext.textBaseline = "alphabetic";
      drawContext.fillText(line, left, y);
      y += lineHeight;
    });
    y += bodyFontSize * 0.72;
  });
  outputPages.push({ ...firstPage, canvas, lines: [] });
  return canvasesToPdf(outputPages, title, content);
}

function paragraphText(paragraph: Element): string {
  return [...paragraph.getElementsByTagNameNS(WORD_NS, "t")]
    .map((node) => node.textContent ?? "")
    .join("");
}

function setTextNodeValue(node: Element, value: string) {
  node.textContent = value;
  if (/^\s|\s$/.test(value)) node.setAttributeNS(XML_NS, "xml:space", "preserve");
  else node.removeAttributeNS(XML_NS, "space");
}

function replaceParagraphText(paragraph: Element, original: string, replacement: string) {
  const nodes = [...paragraph.getElementsByTagNameNS(WORD_NS, "t")];
  if (!nodes.length) return;
  const nodeTexts = nodes.map((node) => node.textContent ?? "");
  const combined = nodeTexts.join("");
  const exactStart = combined.indexOf(original);
  const replaceStart = exactStart >= 0 ? exactStart : 0;
  const replaceEnd = exactStart >= 0 ? exactStart + original.length : combined.length;
  const spans = nodeTexts.map((text, index) => ({
    index,
    start: nodeTexts.slice(0, index).reduce((sum, value) => sum + value.length, 0),
    end: nodeTexts.slice(0, index + 1).reduce((sum, value) => sum + value.length, 0),
    text,
  }));
  const affected = spans.filter((span) => span.end > replaceStart && span.start < replaceEnd);
  if (!affected.length) {
    setTextNodeValue(nodes[0], replacement);
    nodes.slice(1).forEach((node) => setTextNodeValue(node, ""));
    return;
  }

  const first = affected[0];
  const last = affected[affected.length - 1];
  const prefix = first.text.slice(0, Math.max(0, replaceStart - first.start));
  const suffix = last.text.slice(Math.max(0, replaceEnd - last.start));
  setTextNodeValue(nodes[first.index], `${prefix}${replacement}${first === last ? suffix : ""}`);
  affected.slice(1).forEach((span) => {
    setTextNodeValue(nodes[span.index], span === last ? suffix : "");
  });
}

function findBestParagraph(
  paragraphs: Element[],
  originalText: string,
  used: Set<Element>,
): Element | null {
  let best: { paragraph: Element; score: number } | null = null;
  for (const paragraph of paragraphs) {
    if (used.has(paragraph)) continue;
    const score = sourceTextMatchScore(paragraphText(paragraph), originalText);
    if (!best || score > best.score) best = { paragraph, score };
  }
  return best && best.score >= 0.82 ? best.paragraph : null;
}

async function loadDocx(bytes: ArrayBuffer) {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(bytes);
  const documentFile = zip.file("word/document.xml");
  if (!documentFile) throw new Error("The DOCX document body is missing.");
  const xmlText = await documentFile.async("string");
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("The DOCX document body is invalid.");
  return { zip, xml };
}

async function saveDocx(zip: import("jszip"), xml: XMLDocument): Promise<Blob> {
  zip.file("word/document.xml", new XMLSerializer().serializeToString(xml));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}

async function createTailoredDocxFromSource(
  sourceBytes: ArrayBuffer,
  rawSourceText: string,
  content: string,
): Promise<Blob> {
  const { zip, xml } = await loadDocx(sourceBytes);
  const paragraphs = [...xml.getElementsByTagNameNS(WORD_NS, "p")];
  const used = new Set<Element>();
  diffResumeReplacements(rawSourceText, content).forEach((replacement) => {
    const paragraph = findBestParagraph(paragraphs, replacement.originalText, used);
    if (!paragraph) return;
    used.add(paragraph);
    replaceParagraphText(paragraph, replacement.originalText, replacement.replacementText);
  });
  return saveDocx(zip, xml);
}

function cloneParagraphWithText(template: Element, text: string, xml: XMLDocument): Element {
  const clone = template.cloneNode(true) as Element;
  const nodes = [...clone.getElementsByTagNameNS(WORD_NS, "t")];
  if (nodes.length) {
    setTextNodeValue(nodes[0], text);
    nodes.slice(1).forEach((node) => setTextNodeValue(node, ""));
  } else {
    const run = xml.createElementNS(WORD_NS, "w:r");
    const textNode = xml.createElementNS(WORD_NS, "w:t");
    setTextNodeValue(textNode, text);
    run.appendChild(textNode);
    clone.appendChild(run);
  }
  return clone;
}

async function createCoverDocxFromSource(
  sourceBytes: ArrayBuffer,
  rawSourceText: string,
  content: string,
): Promise<Blob> {
  const { zip, xml } = await loadDocx(sourceBytes);
  const body = xml.getElementsByTagNameNS(WORD_NS, "body")[0];
  if (!body) throw new Error("The DOCX document body is missing.");
  const directChildren = [...body.children];
  const sectionProperties = directChildren.find((child) => child.localName === "sectPr") ?? null;
  const sourceHeaderLines = extractResumeHeader(rawSourceText).filter((line) => line.trim());
  let keepThrough = -1;
  for (const headerLine of sourceHeaderLines) {
    let best: { index: number; score: number } | null = null;
    for (const [index, child] of directChildren.slice(0, 12).entries()) {
      const score = sourceTextMatchScore(child.textContent ?? "", headerLine);
      if (!best || score > best.score) best = { index, score };
    }
    if (best && best.score >= 0.62) keepThrough = Math.max(keepThrough, best.index);
  }
  if (keepThrough < 0) {
    keepThrough = Math.min(Math.max(0, sourceHeaderLines.length - 1), directChildren.length - 1);
  }

  const allParagraphs = [...xml.getElementsByTagNameNS(WORD_NS, "p")];
  const bodyTemplate = allParagraphs.find((paragraph) => {
    const text = paragraphText(paragraph);
    return text.length > 60 && !paragraph.getElementsByTagNameNS(WORD_NS, "numPr").length;
  }) ?? allParagraphs.find((paragraph) => paragraphText(paragraph).trim()) ?? null;
  const headingTemplate = allParagraphs.find((paragraph) => {
    const text = paragraphText(paragraph).trim();
    const letters = text.replace(/[^\p{L}]/gu, "");
    return text.length <= 72 && letters.length >= 4 && letters === letters.toUpperCase();
  }) ?? bodyTemplate;
  if (!bodyTemplate || !headingTemplate) throw new Error("Could not identify DOCX text styles.");

  directChildren.forEach((child, index) => {
    if (index > keepThrough && child !== sectionProperties) body.removeChild(child);
  });

  const normalized = content.replace(/\r\n?/g, "\n");
  const header = extractResumeHeader(normalized);
  let bodyText = normalized;
  if (header.length) {
    const firstBodyIndex = normalized.indexOf("\n\n");
    if (firstBodyIndex >= 0) bodyText = normalized.slice(firstBodyIndex + 2);
  }
  const blocks = bodyText.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const insertBefore = sectionProperties;
  blocks.forEach((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    lines.forEach((line, lineIndex) => {
      const emphasized = /^Re\s*:/i.test(line)
        || isCoverSubheading(line)
        || (index === 1 && lineIndex === 0 && lines.length <= 4);
      body.insertBefore(
        cloneParagraphWithText(emphasized ? headingTemplate : bodyTemplate, line, xml),
        insertBefore,
      );
    });
    body.insertBefore(cloneParagraphWithText(bodyTemplate, "", xml), insertBefore);
  });
  return saveDocx(zip, xml);
}

const GENERIC_DOCX_BULLET_RE = /^\s*(?:[-*•●▪◦‣–—]|\d+[.)])\s+(.*)$/u;
const GENERIC_DOCX_SECTION_RE = /^(?:summary|profile|objective|experience|work experience|professional experience|education|skills|technical skills|projects|certifications|languages|publications|research|awards|volunteer(?:ing)?|interests)$/i;

function looksLikeGenericDocxHeading(line: string): boolean {
  const trimmed = line.trim().replace(/[:|]$/, "");
  if (!trimmed || trimmed.length > 64) return false;
  if (GENERIC_DOCX_SECTION_RE.test(trimmed)) return true;
  const letters = trimmed.replace(/[^\p{L}]/gu, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

// Fallback DOCX export for source resumes that were not themselves uploaded as
// DOCX (PDF or plain text). It cannot reproduce the original file's exact
// fonts/layout — that fidelity is only possible when the source is a DOCX —
// but it lets users download an editable Word version of any tailored document.
async function createGenericDocx(content: string, title: string): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import("docx");

  const paragraphs = content.replace(/\r\n?/g, "\n").split("\n").map((rawLine) => {
    if (!rawLine.trim()) {
      return new Paragraph({ text: "", spacing: { after: 100 } });
    }

    const bulletMatch = rawLine.match(GENERIC_DOCX_BULLET_RE);
    if (bulletMatch) {
      return new Paragraph({
        children: [new TextRun({ text: bulletMatch[1].trim(), font: "Calibri", size: 22 })],
        bullet: { level: 0 },
        spacing: { after: 60 },
      });
    }

    if (looksLikeGenericDocxHeading(rawLine)) {
      return new Paragraph({
        children: [new TextRun({ text: rawLine.trim(), font: "Calibri", size: 22, bold: true })],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
      });
    }

    const indentLevel = Math.min(rawLine.match(/^\s*/)?.[0].length ?? 0, 8);
    return new Paragraph({
      children: [new TextRun({ text: rawLine.trim(), font: "Calibri", size: 22 })],
      indent: indentLevel ? { left: indentLevel * 120 } : undefined,
      spacing: { after: 80 },
    });
  });

  const doc = new Document({
    title,
    creator: "HireMe",
    styles: {
      default: {
        document: { run: { font: "Calibri", size: 22 } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } },
        },
        children: paragraphs,
      },
    ],
  });
  return Packer.toBlob(doc);
}

export async function createSourceFormattedArtifact({
  sourceType,
  sourceUrl,
  rawSourceText,
  content,
  documentType,
  title,
}: {
  sourceType: ResumeSourceType;
  sourceUrl: string | null;
  rawSourceText: string;
  content: string;
  documentType: PrintableDocumentType;
  title: string;
}): Promise<SourceFormattedArtifact> {
  const artifactContent = documentType === "cover_letter"
    ? stripAccidentalResumePrefixFromCoverLetter(content, rawSourceText)
    : !hasUsableResumeLineStructure(content) && hasUsableResumeLineStructure(rawSourceText)
      ? rawSourceText
      : content;

  if (sourceType === "txt" || !sourceUrl) {
    return {
      previewType: "pdf",
      sourceType: "txt",
      pdfBlob: await createApplicationPdf(artifactContent, documentType, title),
      docxBlob: await createGenericDocx(artifactContent, title),
    };
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(await sourceDocumentLoadErrorMessage(response));
  }
  const sourceBytes = await response.arrayBuffer();
  if (!sourceDocumentHasBytes(sourceBytes)) {
    throw new Error("The uploaded document/PDF is empty.");
  }

  if (sourceType === "pdf") {
    return {
      previewType: "pdf",
      sourceType,
      pdfBlob: documentType === "tailored_resume"
        ? await createTailoredPdfFromSource(sourceBytes, rawSourceText, artifactContent, title)
        : await createCoverPdfFromSource(sourceBytes, rawSourceText, artifactContent, title),
      docxBlob: await createGenericDocx(artifactContent, title),
    };
  }

  return {
    previewType: "docx",
    sourceType,
    docxBlob: documentType === "tailored_resume"
      ? await createTailoredDocxFromSource(sourceBytes, rawSourceText, artifactContent)
      : await createCoverDocxFromSource(sourceBytes, rawSourceText, artifactContent),
  };
}

export function sourceDocumentHasBytes(sourceBytes: { byteLength: number }): boolean {
  return sourceBytes.byteLength > 0;
}

export async function sourceDocumentLoadErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // The endpoint may return a generic platform error instead of JSON.
  }
  return SOURCE_DOCUMENT_LOAD_ERROR;
}

export async function renderDocxPreview(blob: Blob, container: HTMLElement): Promise<void> {
  const { renderAsync } = await import("docx-preview");
  const staging = document.createElement("div");
  await renderAsync(blob, staging, undefined, {
    className: "source-docx-preview",
    inWrapper: true,
    ignoreWidth: false,
    ignoreHeight: false,
    ignoreFonts: false,
    breakPages: true,
    renderHeaders: true,
    renderFooters: true,
    renderFootnotes: true,
  });
  container.replaceChildren(...staging.childNodes);
}

export async function docxPreviewToPdf(container: HTMLElement, title: string): Promise<Blob> {
  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF: JsPdf } = await import("jspdf");
  const pageElements = [...container.querySelectorAll<HTMLElement>("section.source-docx-preview")];
  const pages = pageElements.length ? pageElements : [...container.querySelectorAll<HTMLElement>("section.docx")];
  if (!pages.length) throw new Error("The DOCX preview has no pages.");

  let doc: InstanceType<typeof JsPdf> | null = null;
  for (const page of pages) {
    const canvas = await html2canvas(page, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const widthPt = page.offsetWidth * 0.75;
    const heightPt = page.offsetHeight * 0.75;
    if (!doc) {
      doc = new JsPdf({
        orientation: widthPt > heightPt ? "landscape" : "portrait",
        unit: "pt",
        format: [widthPt, heightPt],
        compress: true,
      });
    } else {
      doc.addPage([widthPt, heightPt], widthPt > heightPt ? "landscape" : "portrait");
    }
    doc.addImage(canvas.toDataURL("image/jpeg", 0.97), "JPEG", 0, 0, widthPt, heightPt);
    const pageSearchLines = pdfSearchLines(page.innerText);
    if (pageSearchLines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(2);
      doc.text(pageSearchLines, 2, 3, {
        lineHeightFactor: 1,
        renderingMode: "invisible",
      });
    }
  }
  if (!doc) throw new Error("The DOCX preview has no pages.");
  doc.setProperties({ title, creator: "HireMe" });
  return doc.output("blob");
}
