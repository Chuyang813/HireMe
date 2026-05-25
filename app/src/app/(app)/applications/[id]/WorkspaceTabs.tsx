"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  saveDocumentAction,
  analyzeAssessmentAction,
  scoreResumeAction,
  getDocumentVersionsAction,
  type DocumentVersion,
} from "@/app/actions/ai";
import { Button } from "@/components/ui/Button";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import type {
  ApplicationDocument,
  AssessmentAnalysis,
  DocumentType,
  ResumeScore,
} from "@/lib/db/types";
import type { GroundingWarning } from "@/lib/ai/grounding";

// ---------------------------------------------------------------------------
// Tab config — Notes tab removed
// ---------------------------------------------------------------------------

type TabId =
  | "resume"
  | "cover_letter"
  | "email"
  | "assessment"
  | "interview_prep";

const TABS: { id: TabId; labelKey: string; shortLabelKey: string; docType?: DocumentType }[] = [
  { id: "resume", labelKey: "tabResume", shortLabelKey: "sideResume", docType: "tailored_resume" },
  { id: "cover_letter", labelKey: "tabCoverLetter", shortLabelKey: "sideCoverLetter", docType: "cover_letter" },
  { id: "email", labelKey: "tabEmail", shortLabelKey: "sideEmail", docType: "email_draft" },
  { id: "assessment", labelKey: "tabAssessment", shortLabelKey: "sideAssessment" },
  { id: "interview_prep", labelKey: "tabInterviewPrep", shortLabelKey: "sideInterviewPrep" },
];

// ---------------------------------------------------------------------------
// Style constants for document generation
// ---------------------------------------------------------------------------

const RESUME_STYLES = [
  { value: 'professional', labelKey: 'styleProfessional' },
  { value: 'concise', labelKey: 'styleConcise' },
  { value: 'creative', labelKey: 'styleCreative' },
  { value: 'academic', labelKey: 'styleAcademic' },
] as const;

const COVER_LETTER_STYLES = [
  { value: 'professional', labelKey: 'styleProfessional' },
  { value: 'story', labelKey: 'styleStory' },
  { value: 'concise', labelKey: 'styleConcise' },
  { value: 'enthusiastic', labelKey: 'styleEnthusiastic' },
] as const;

// ---------------------------------------------------------------------------
// Export helpers (browser-only, loaded lazily)
// ---------------------------------------------------------------------------

function sanitizeName(s: string) {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

async function exportPDF(content: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginY = 24;
  const maxW = pageW - marginX * 2;
  let y = marginY;

  function checkPage(needed: number) {
    if (y + needed > pageH - marginY) {
      doc.addPage();
      y = marginY;
    }
  }

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();

    if (line.startsWith("# ")) {
      checkPage(12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(line.slice(2), marginX, y);
      y += 9;
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(marginX, y, pageW - marginX, y);
      y += 5;
      doc.setDrawColor(0, 0, 0);
    } else if (line.startsWith("## ")) {
      checkPage(10);
      y += 3;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(line.slice(3).toUpperCase(), marginX, y);
      y += 5;
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.2);
      doc.line(marginX, y, pageW - marginX, y);
      y += 4;
      doc.setDrawColor(0, 0, 0);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const text = line.slice(2);
      const wrapped = doc.splitTextToSize(text, maxW - 6) as string[];
      checkPage(wrapped.length * 5 + 1);
      doc.text("•", marginX + 2, y);
      doc.text(wrapped, marginX + 7, y);
      y += wrapped.length * 5 + 1;
    } else if (line === "") {
      y += 3;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const wrapped = doc.splitTextToSize(line, maxW) as string[];
      checkPage(wrapped.length * 5 + 1);
      doc.text(wrapped, marginX, y);
      y += wrapped.length * 5 + 1;
    }
  }

  doc.save(`${filename}.pdf`);
}

async function exportDOCX(content: string, filename: string) {
  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
  } = await import("docx");

  const paragraphs: InstanceType<typeof Paragraph>[] = [];

  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();

    if (line.startsWith("# ")) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(2),
          heading: HeadingLevel.TITLE,
          spacing: { after: 120 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "AAAAAA", space: 4 },
          },
        }),
      );
    } else if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          text: line.slice(3),
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 80 },
        }),
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line.slice(2), font: "Calibri", size: 22 })],
          bullet: { level: 0 },
          spacing: { after: 80 },
        }),
      );
    } else if (line === "") {
      paragraphs.push(new Paragraph({ spacing: { after: 80 } }));
    } else {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun({ text: line, font: "Calibri", size: 22 })],
          spacing: { after: 100 },
          alignment: AlignmentType.LEFT,
        }),
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 },
          },
        },
        children: paragraphs,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// MarkdownViewer — renders markdown as formatted HTML
// ---------------------------------------------------------------------------

function applyInline(text: string): React.ReactNode[] {
  // Handle **bold** and *italic* inline
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part;
  });
}

function MarkdownViewer({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const t = useTranslations("Workspace");

  if (!content.trim()) {
    return (
      <p className="text-sm text-muted-foreground italic">
        {t("noContent")}
      </p>
    );
  }

  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-1 space-y-0.5 pl-4">
        {listItems.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <span>{applyInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
    listItems = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("# ")) {
      flushList();
      nodes.push(
        <h1 key={i} className="font-display text-2xl leading-tight mt-2 mb-1">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushList();
      nodes.push(
        <h2
          key={i}
          className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-5 mb-1.5 border-b border-border pb-1"
        >
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushList();
      nodes.push(
        <h3 key={i} className="text-sm font-semibold mt-3 mb-1">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      listItems.push(line.slice(2));
    } else if (line.trim() === "") {
      flushList();
      nodes.push(<div key={i} className="h-1.5" />);
    } else {
      flushList();
      nodes.push(
        <p key={i} className="text-sm leading-relaxed">
          {applyInline(line)}
        </p>,
      );
    }
  }
  flushList();

  return (
    <div className={`rounded-md border border-border bg-white p-6 min-h-[28rem] shadow-sm${isStreaming ? ' streaming' : ''}`}>
      {nodes}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailDraftView — parses the AI-formatted email into structured sections
// (subject / body / signature / attachments) and renders them with the
// HireMe postal aesthetic. Falls back to raw text if parsing fails.
// ---------------------------------------------------------------------------

type ParsedAttachment = { name: string; reason?: string };
type ParsedEmail = {
  subject: string;
  body: string;
  signature: string;
  attachments: ParsedAttachment[];
};

const SIGNATURE_OPENERS = /^(best regards|sincerely|kind regards|regards|yours sincerely|warm regards|thank you|many thanks|with appreciation|respectfully)[,.]?\s*$/i;

function parseEmailDraft(text: string): ParsedEmail {
  const lines = text.replace(/\r\n/g, "\n").split("\n");

  let subject = "";
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*Subject\s*:\s*(.*)$/i);
    if (m) {
      subject = m[1].trim();
      bodyStart = i + 1;
      break;
    }
  }

  let attachmentsIdx = -1;
  for (let i = bodyStart; i < lines.length; i++) {
    if (/^\s*Attachments\s*:\s*$/i.test(lines[i])) {
      attachmentsIdx = i;
      break;
    }
    const inline = lines[i].match(/^\s*Attachments\s*:\s*(.+)$/i);
    if (inline) {
      attachmentsIdx = i;
      break;
    }
  }

  const bodyEnd = attachmentsIdx === -1 ? lines.length : attachmentsIdx;
  const bodySlice = lines.slice(bodyStart, bodyEnd);
  while (bodySlice.length && bodySlice[0].trim() === "") bodySlice.shift();
  while (bodySlice.length && bodySlice[bodySlice.length - 1].trim() === "") bodySlice.pop();

  let sigStart = -1;
  for (let i = 0; i < bodySlice.length; i++) {
    if (SIGNATURE_OPENERS.test(bodySlice[i].trim())) {
      sigStart = i;
      break;
    }
  }
  const messageLines = sigStart === -1 ? bodySlice : bodySlice.slice(0, sigStart);
  const signatureLines = sigStart === -1 ? [] : bodySlice.slice(sigStart);
  while (messageLines.length && messageLines[messageLines.length - 1].trim() === "") messageLines.pop();

  const attachments: ParsedAttachment[] = [];
  if (attachmentsIdx !== -1) {
    const inlineMatch = lines[attachmentsIdx].match(/^\s*Attachments\s*:\s*(.+)$/i);
    const candidates: string[] = [];
    if (inlineMatch) {
      for (const part of inlineMatch[1].split(",")) {
        const trimmed = part.trim();
        if (trimmed) candidates.push(trimmed);
      }
    }
    for (let i = attachmentsIdx + 1; i < lines.length; i++) {
      const raw = lines[i].trim();
      if (!raw) continue;
      const stripped = raw.replace(/^[-*\s]*/, "");
      candidates.push(stripped);
    }
    for (const item of candidates) {
      const dash = item.match(/^(.+?)\s+(?:-|:)\s+(.+)$/);
      if (dash) {
        attachments.push({ name: dash[1].trim(), reason: dash[2].trim() });
      } else {
        attachments.push({ name: item.trim() });
      }
    }
  }

  return {
    subject,
    body: messageLines.join("\n"),
    signature: signatureLines.join("\n"),
    attachments,
  };
}

function EmailDraftView({ content }: { content: string }) {
  const t = useTranslations("Workspace");
  const parsed = parseEmailDraft(content);
  const hasStructure =
    parsed.subject || parsed.signature || parsed.attachments.length > 0;

  if (!hasStructure) {
    return (
      <div className="rounded-md border border-border bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-3">
          <span className="label-caps">{t("emailDraftHeader")}</span>
        </div>
        <div className="whitespace-pre-wrap p-6 text-sm leading-relaxed text-foreground">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-3">
        <span className="label-caps">{t("emailDraftHeader")}</span>
        <span className="text-xs text-muted-foreground">{t("emailSuggestionHint")}</span>
      </div>

      {parsed.subject && (
        <div className="grid grid-cols-[5rem_1fr] gap-4 border-b border-border px-6 py-4">
          <span className="label-caps pt-0.5">{t("emailSubjectLabel")}</span>
          <p className="font-display text-base leading-snug text-foreground">
            {parsed.subject}
          </p>
        </div>
      )}

      {parsed.body && (
        <div className="px-6 py-5">
          <p className="label-caps mb-3">{t("emailBodyLabel")}</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {parsed.body}
          </div>
        </div>
      )}

      {parsed.signature && (
        <div className="border-t border-border px-6 py-4">
          <p className="label-caps mb-2">{t("emailSignatureLabel")}</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {parsed.signature}
          </div>
        </div>
      )}

      {parsed.attachments.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-6 py-4">
          <p className="label-caps mb-3">{t("emailAttachmentsLabel")}</p>
          <ul className="flex flex-col gap-2">
            {parsed.attachments.map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-sm border border-border bg-white px-2 py-0.5 text-xs text-foreground">
                  <span className="text-muted-foreground">◆</span>
                  <span className="font-medium">{a.name}</span>
                </span>
                {a.reason && (
                  <span className="leading-relaxed text-muted-foreground italic">
                    {a.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs italic text-muted-foreground">
            {t("emailFilenameHint")}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HistoryDropdown — lists saved versions and allows restoring
// ---------------------------------------------------------------------------

function HistoryDropdown({
  documentId,
  onRestore,
}: {
  documentId: string;
  onRestore: (content: string) => void;
}) {
  const t = useTranslations("Workspace");
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleOpen() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (versions.length > 0) return;
    setLoading(true);
    setError("");
    const res = await getDocumentVersionsAction(documentId);
    setLoading(false);
    if ("error" in res) { setError(res.error); return; }
    setVersions(res.versions);
  }

  if (!documentId) return null;

  return (
    <div className="relative">
      <Button variant="outline" onClick={handleOpen}>
        {t("historyButton")}
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-background shadow-lg">
          {loading && <p className="px-4 py-3 text-sm text-muted-foreground">{t("historyLoading")}</p>}
          {error && <p className="px-4 py-3 text-sm text-danger">{error}</p>}
          {!loading && !error && versions.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">{t("historyEmpty")}</p>
          )}
          {versions.map((v) => (
            <button
              key={v.id}
              onClick={() => { onRestore(v.content); setOpen(false); }}
              className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-muted border-b border-border last:border-0"
            >
              <span className="text-xs text-muted-foreground">
                {new Date(v.created_at).toLocaleString()}
              </span>
              <span className="truncate text-sm">{v.content.slice(0, 80)}…</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentPanel — rendered view + generate/save/export
// ---------------------------------------------------------------------------

function DocumentPanel({
  applicationId,
  documentType,
  existingDoc,
  hasResume,
  exportFilename,
  showEmail,
}: {
  applicationId: string;
  documentType: DocumentType;
  existingDoc: ApplicationDocument | null;
  hasResume: boolean;
  exportFilename: string;
  showEmail?: boolean;
}) {
  const t = useTranslations("Workspace");
  const [content, setContent] = useState(existingDoc?.text_content ?? "");
  const [docId, setDocId] = useState(existingDoc?.id ?? "");
  const [generateError, setGenerateError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [groundingWarnings, setGroundingWarnings] = useState<GroundingWarning[]>([]);
  const [style, setStyle] = useState("professional");

  const styleOptions =
    documentType === "tailored_resume"
      ? RESUME_STYLES
      : documentType === "cover_letter"
        ? COVER_LETTER_STYLES
        : null;

  async function saveContent(nextContent: string) {
    if (!nextContent.trim() || nextContent.includes("[Error:")) return false;
    setSaveStatus("idle");
    setAutoSaving(true);

    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("document_type", documentType);
    fd.set("content", nextContent);
    if (docId) fd.set("document_id", docId);

    try {
      const result = await saveDocumentAction(undefined, fd);
      if (result && "ok" in result && result.ok) {
        setDocId(result.documentId);
        setGroundingWarnings(result.groundingWarnings ?? []);
        setSaveStatus("saved");
        return true;
      }
    } catch {
      // Surface a simple save error below; generation content remains visible.
    } finally {
      setAutoSaving(false);
    }

    setSaveStatus("error");
    return false;
  }

  async function handleGenerate() {
    setGenerateError("");
    setSaveStatus("idle");
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          document_type: documentType,
          style,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setGenerateError(json.error ?? t("generationFailed"));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setGenerateError(t("streamingUnsupported"));
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let rafId: ReturnType<typeof requestAnimationFrame> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        // Throttle state updates with requestAnimationFrame
        if (rafId) cancelAnimationFrame(rafId);
        const snapshot = accumulated;
        rafId = requestAnimationFrame(() => setContent(snapshot));
      }
      // Final flush
      if (rafId) cancelAnimationFrame(rafId);
      setContent(accumulated);
      if (accumulated.includes("[Error:")) {
        setGenerateError(t("generationFailed"));
        return;
      }
      await saveContent(accumulated);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : t("generationFailed"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may be unavailable in some contexts
    }
  }

  async function handleExport(format: "pdf" | "docx") {
    if (!content.trim()) return;
    setExporting(true);
    try {
      if (format === "pdf") {
        await exportPDF(content, exportFilename);
      } else {
        await exportDOCX(content, exportFilename);
      }
    } finally {
      setExporting(false);
    }
  }

  if (showEmail) {
    // Email draft — styled copyable card, no download
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!hasResume && (
            <p className="text-sm text-muted-foreground">
              {t.rich("uploadResumeHint", {
                link: (chunks) => (
                  <a href="/resumes" className="underline underline-offset-2 text-accent">
                    {chunks}
                  </a>
                ),
              })}
            </p>
          )}
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={handleGenerate}
              disabled={generating || !hasResume}
            >
              {generating ? t("generating") : t("generate")}
            </Button>
            {content && (
              <Button variant="outline" onClick={handleCopy}>
                {copied ? t("copied") : t("copyToClipboard")}
              </Button>
            )}
            {docId && (
              <HistoryDropdown
                documentId={docId}
                onRestore={(restored) => {
                  setContent(restored);
                  void saveContent(restored);
                }}
              />
            )}
          </div>
        </div>

        {generateError && (
          <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            {generateError}
          </p>
        )}
        <GroundingWarnings warnings={groundingWarnings} />

        {generating && !content ? (
          <div className="flex min-h-[18rem] items-center justify-center rounded-md border border-border bg-white shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
              <p className="text-sm text-muted-foreground">{t("draftingEmail")}</p>
            </div>
          </div>
        ) : content ? (
          <EmailDraftView content={content} />
        ) : (
          <div className="flex min-h-[18rem] items-center justify-center rounded-md border border-dashed border-border bg-muted/30 px-8 py-12 text-center">
            <div className="max-w-sm">
              <p className="label-caps mb-2">{t("emailEmptyLabel")}</p>
              <p className="text-sm text-muted-foreground">
                {t("emailEmptyBody")}
              </p>
            </div>
          </div>
        )}

        {docId && content && !generating && (
          <div className="flex justify-end">
            <FeedbackButtons documentId={docId} feedbackType="email" />
          </div>
        )}
        {autoSaving && <p className="text-xs text-muted-foreground">{t("saving")}</p>}
        {saveStatus === "saved" && <p className="text-xs text-success">{t("saved")}</p>}
        {saveStatus === "error" && <p className="text-xs text-danger">{t("saveFailed")}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {styleOptions && (
        <div className="flex items-center gap-2">
          <label className="label-caps text-muted-foreground shrink-0">
            {t("styleSelectorLabel")}
          </label>
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          >
            {styleOptions.map((s) => (
              <option key={s.value} value={s.value}>
                {t(s.labelKey)}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hasResume && (
          <p className="text-sm text-muted-foreground">
            {t.rich("uploadResumeHint", {
                link: (chunks) => (
                  <a href="/resumes" className="underline underline-offset-2 text-accent">
                    {chunks}
                  </a>
                ),
              })}
          </p>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || !hasResume}
          >
            {generating ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                {t("generating")}
              </span>
            ) : t("generate")}
          </Button>
          {content && (
            <>
              <Button variant="outline" onClick={handleCopy}>
                {copied ? t("copied") : t("copy")}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("pdf")}
                disabled={exporting || !content.trim()}
                title={t("downloadPDF")}
              >
                {t("downloadPDF")}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("docx")}
                disabled={exporting || !content.trim()}
                title={t("downloadDOCX")}
              >
                {t("downloadDOCX")}
              </Button>
            </>
          )}
          {docId && (
            <HistoryDropdown
              documentId={docId}
              onRestore={(restored) => {
                setContent(restored);
                void saveContent(restored);
              }}
            />
          )}
        </div>
      </div>

      {generateError && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {generateError}
        </p>
      )}
      <GroundingWarnings warnings={groundingWarnings} />

      {generating && !content && (
        <div className="flex min-h-[28rem] items-center justify-center rounded-md border border-border bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm text-muted-foreground">{t("generatingDocument")}</p>
          </div>
        </div>
      )}
      {(!generating || content) && <MarkdownViewer content={content} isStreaming={generating} />}

      {docId && content && !generating && (
        <div className="flex justify-end">
          <FeedbackButtons
            documentId={docId}
            feedbackType={documentType === 'cover_letter' ? 'cover_letter' : 'resume'}
          />
        </div>
      )}
      {autoSaving && <p className="text-xs text-muted-foreground">{t("saving")}</p>}
      {saveStatus === "saved" && <p className="text-xs text-success">{t("saved")}</p>}
      {saveStatus === "error" && <p className="text-xs text-danger">{t("saveFailed")}</p>}
    </div>
  );
}

function GroundingWarnings({ warnings }: { warnings: GroundingWarning[] }) {
  if (!warnings.length) return null;

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <p className="font-medium">AI grounding review suggested</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {warnings.slice(0, 5).map((warning) => (
          <li key={`${warning.kind}:${warning.value}`}>
            {warning.message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AssessmentPanel
// ---------------------------------------------------------------------------

function AssessmentChecklist({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="label-caps mb-2">{label}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 shrink-0 text-muted-foreground">◻</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssessmentResults({ result }: { result: AssessmentAnalysis }) {
  const t = useTranslations("Workspace");

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-md border border-border p-4 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-caps mb-1.5">{t("summaryLabel")}</p>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </div>
          {result.estimated_effort_hours != null && (
            <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground">
              ~{result.estimated_effort_hours}h
            </span>
          )}
        </div>
      </div>

      {result.deliverables?.length ? (
        <div>
          <p className="label-caps mb-2">{t("deliverablesLabel")}</p>
          <ul className="space-y-1">
            {result.deliverables.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="mt-0.5 shrink-0 text-muted-foreground">◆</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.evaluation_criteria?.length ? (
        <div>
          <p className="label-caps mb-2">{t("evalCriteriaLabel")}</p>
          <ul className="space-y-1">
            {result.evaluation_criteria.map((c, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                — {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AssessmentChecklist items={result.preparation_steps ?? []} label={t("prepStepsLabel")} />
      <AssessmentChecklist items={result.checklist ?? []} label={t("keyChecklistLabel")} />
    </div>
  );
}

function AssessmentPanel({ applicationId }: { applicationId: string }) {
  const t = useTranslations("Workspace");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<AssessmentAnalysis | null>(null);
  const [error, setError] = useState("");
  const [analyzing, startAnalyze] = useTransition();

  function handleAnalyze() {
    if (!file) return;
    setError("");
    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("file", file);
    startAnalyze(async () => {
      const res = await analyzeAssessmentAction(undefined, fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else if (res && "result" in res && res.result) {
        setResult(res.result);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        {t("assessmentDescription")}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm hover:bg-muted shadow-sm">
          <span>{file ? file.name : t("chooseFile")}</span>
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            className="sr-only"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setResult(null);
              setError("");
            }}
          />
        </label>
        <Button onClick={handleAnalyze} disabled={!file || analyzing}>
          {analyzing ? t("analyzing") : t("analyze")}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {result && <AssessmentResults result={result} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InterviewPrepPanel
// ---------------------------------------------------------------------------

function InterviewPrepPanel({
  applicationId,
  hasResume,
  existingDoc,
}: {
  applicationId: string;
  hasResume: boolean;
  existingDoc: ApplicationDocument | null;
}) {
  const t = useTranslations("Workspace");
  const [content, setContent] = useState(existingDoc?.text_content ?? "");
  const [docId, setDocId] = useState(existingDoc?.id ?? "");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [autoSaving, setAutoSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  async function saveContent(markdown: string) {
    setSaveStatus("idle");
    setAutoSaving(true);
    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("document_type", "interview_prep");
    fd.set("content", markdown);
    if (docId) fd.set("document_id", docId);
    try {
      const res = await saveDocumentAction(undefined, fd);
      if (res && "ok" in res && res.ok) {
        setDocId(res.documentId);
        setSaveStatus("saved");
        return;
      }
    } catch {
      // Keep the generated prep visible even if persistence fails.
    } finally {
      setAutoSaving(false);
    }
    setSaveStatus("error");
  }

  async function handleGenerate() {
    setError("");
    setSaveStatus("idle");
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          document_type: "interview_prep",
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setError(json.error ?? t("generationFailed"));
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setError(t("streamingUnsupported"));
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      let rafId: ReturnType<typeof requestAnimationFrame> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });

        if (rafId) cancelAnimationFrame(rafId);
        const snapshot = accumulated;
        rafId = requestAnimationFrame(() => setContent(snapshot));
      }
      if (rafId) cancelAnimationFrame(rafId);
      setContent(accumulated);
      if (accumulated.includes("[Error:")) {
        setError(t("generationFailed"));
        return;
      }
      await saveContent(accumulated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("generationFailed"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hasResume && (
          <p className="text-sm text-muted-foreground">
            {t.rich("uploadResumeHint", {
                link: (chunks) => (
                  <a href="/resumes" className="underline underline-offset-2 text-accent">
                    {chunks}
                  </a>
                ),
              })}
          </p>
        )}
        <Button
          onClick={handleGenerate}
          disabled={generating || !hasResume}
          className="ml-auto"
        >
          {generating ? (
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
              {t("generating")}
            </span>
          ) : t("generateInterviewPrep")}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {autoSaving && <p className="text-xs text-muted-foreground">{t("saving")}</p>}
      {saveStatus === "saved" && <p className="text-xs text-success">{t("saved")}</p>}
      {saveStatus === "error" && <p className="text-xs text-danger">{t("saveFailed")}</p>}

      {generating && !content && (
        <div className="flex min-h-[28rem] items-center justify-center rounded-md border border-border bg-white shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
            <p className="text-sm text-muted-foreground">{t("generatingDocument")}</p>
          </div>
        </div>
      )}
      {(!generating || content) && <MarkdownViewer content={content} isStreaming={generating} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoreCard — resume vs job match
// ---------------------------------------------------------------------------

function scoreColor(score: number) {
  if (score >= 75) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function ScoreCard({ result }: { result: ResumeScore }) {
  const t = useTranslations("Workspace");
  const color = scoreColor(result.score);
  return (
    <div className="mt-4 rounded-md border border-border bg-white p-5 shadow-sm space-y-5">
      <div className="flex items-center gap-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold"
          style={{ borderColor: color, color }}
        >
          {result.score}
        </div>
        <div>
          <p className="label-caps text-muted-foreground mb-0.5">{t("matchScore")}</p>
          <div className="h-2 w-48 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${result.score}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>

      {result.strengths?.length ? (
        <div>
          <p className="label-caps mb-2">{t("strengths")}</p>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0 text-success">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.gaps?.length ? (
        <div>
          <p className="label-caps mb-2">{t("gaps")}</p>
          <ul className="space-y-1">
            {result.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0 text-danger">✗</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.suggestions?.length ? (
        <div>
          <p className="label-caps mb-2">{t("topSuggestions")}</p>
          <ol className="space-y-1.5">
            {result.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <span className="shrink-0 label-caps text-muted-foreground">{i + 1}.</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </div>
  );
}

function ScorePanel({
  applicationId,
  hasResume,
}: {
  applicationId: string;
  hasResume: boolean;
}) {
  const t = useTranslations("Workspace");
  const [scoreResult, setScoreResult] = useState<ResumeScore | null>(null);
  const [error, setError] = useState("");
  const [scoring, startScore] = useTransition();

  function runScore() {
    setError("");
    const fd = new FormData();
    fd.set("application_id", applicationId);
    startScore(async () => {
      const res = await scoreResumeAction(undefined, fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else if (res && "result" in res && res.result) {
        setScoreResult(res.result);
      }
    });
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={runScore}
          disabled={scoring || !hasResume}
        >
          {scoring ? t("scoring") : scoreResult ? t("reScore") : t("scoreResume")}
        </Button>
        {!hasResume && (
          <p className="text-sm text-muted-foreground">
            {t("uploadForScoring")}
          </p>
        )}
        {scoring && (
          <p className="text-sm text-muted-foreground animate-pulse">{t("analyzingMatch")}</p>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-md border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}
      {scoreResult && <ScoreCard result={scoreResult} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceTabs root
// ---------------------------------------------------------------------------

export function WorkspaceTabs({
  applicationId,
  hasResume,
  documents,
  roleTitle,
  userFirstName,
  companyName,
  statusLabel,
}: {
  applicationId: string;
  hasResume: boolean;
  documents: {
    tailored_resume: ApplicationDocument | null;
    cover_letter: ApplicationDocument | null;
    email_draft: ApplicationDocument | null;
    interview_prep: ApplicationDocument | null;
  };
  roleTitle?: string;
  userFirstName?: string;
  companyName?: string;
  statusLabel?: string;
}) {
  const t = useTranslations("Workspace");
  const [activeTab, setActiveTab] = useState<TabId>("resume");

  const firstName = sanitizeName(userFirstName ?? "Resume");
  const company = sanitizeName(companyName ?? "Company");

  const resumeFilename = `${firstName}_${company}_Resume`;
  const coverFilename = `${firstName}_${company}_CoverLetter`;

  const documentStatus: Partial<Record<DocumentType, boolean>> = {
    tailored_resume: !!documents.tailored_resume,
    cover_letter: !!documents.cover_letter,
    email_draft: !!documents.email_draft,
    interview_prep: !!documents.interview_prep,
  };

  const activeLabel = t(TABS.find((tab) => tab.id === activeTab)?.labelKey ?? "tabResume");

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
        <div className="min-w-0">
          <p className="font-display text-2xl leading-tight">
            {roleTitle || t("workspaceUntitledRole")}
          </p>
          <p className="mt-1 truncate text-sm text-muted-foreground">
            {companyName || t("workspaceUnknownCompany")}
          </p>
        </div>
        {statusLabel ? (
          <span className="rounded-full bg-slate-100 px-4 py-1.5 text-sm font-medium text-slate-700">
            {statusLabel}
          </span>
        ) : null}
      </div>

      <div className="grid min-h-[40rem] grid-cols-1 lg:grid-cols-[15.5rem_1fr]">
        <nav className="border-b border-border bg-muted/25 p-4 lg:border-b-0 lg:border-r">
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDone = tab.docType ? documentStatus[tab.docType] : false;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "group flex min-w-fit items-center gap-3 rounded-md px-4 py-3 text-left text-sm transition-colors",
                    isActive
                      ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                  ].join(" ")}
                  aria-current={isActive ? "page" : undefined}
                >
                  <span
                    className={[
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs",
                      isDone
                        ? "bg-accent text-accent-foreground"
                        : isActive
                          ? "border border-accent text-accent"
                          : "border border-border text-muted-foreground",
                    ].join(" ")}
                    aria-hidden="true"
                  >
                    {isDone ? "✓" : ""}
                  </span>
                  <span className="whitespace-nowrap font-medium">
                    {t(tab.shortLabelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        <section className="min-w-0 p-5 sm:p-8">
          <p className="label-caps mb-5 text-muted-foreground">{activeLabel}</p>
          {activeTab === "resume" && (
            <>
              <DocumentPanel
                applicationId={applicationId}
                documentType="tailored_resume"
                existingDoc={documents.tailored_resume}
                hasResume={hasResume}
                exportFilename={resumeFilename}
              />
              <div className="mt-6 border-t border-border pt-6">
                <p className="label-caps mb-1">{t("resumeScoringLabel")}</p>
                <p className="mb-3 text-xs text-muted-foreground">
                  {t("resumeScoringDesc")}
                </p>
                <ScorePanel applicationId={applicationId} hasResume={hasResume} />
              </div>
            </>
          )}
          {activeTab === "cover_letter" && (
            <DocumentPanel
              applicationId={applicationId}
              documentType="cover_letter"
              existingDoc={documents.cover_letter}
              hasResume={hasResume}
              exportFilename={coverFilename}
            />
          )}
          {activeTab === "email" && (
            <DocumentPanel
              applicationId={applicationId}
              documentType="email_draft"
              existingDoc={documents.email_draft}
              hasResume={hasResume}
              exportFilename=""
              showEmail
            />
          )}
          {activeTab === "assessment" && (
            <AssessmentPanel applicationId={applicationId} />
          )}
          {activeTab === "interview_prep" && (
            <InterviewPrepPanel
              applicationId={applicationId}
              hasResume={hasResume}
              existingDoc={documents.interview_prep}
            />
          )}
        </section>
      </div>
    </div>
  );
}
