"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  saveDocumentAction,
  analyzeAssessmentAction,
  getApplicationResumeSourceAction,
  getDocumentVersionsAction,
  type DocumentVersion,
} from "@/app/actions/ai";
import { runResumeEvals } from "@/app/actions/eval";
import type { ATSResult } from "@/lib/ai/ats-score";
import type { FabricationResult } from "@/lib/ai/fabrication-check";
import { Button } from "@/components/ui/Button";
import { FeedbackButtons } from "@/components/FeedbackButtons";
import type {
  ApplicationDocument,
  AssessmentAnalysis,
  DocumentType,
} from "@/lib/db/types";
import type {
  GenerationStage,
  GenerationStreamEvent,
} from "@/lib/ai/generation-stream";
import {
  SourceDocumentPreview,
  type SourceDocumentPreviewHandle,
} from "@/components/SourceDocumentPreview";
import type { ResumeSourceType } from "@/lib/documents/source-document";
import {
  DEMO_ASSESSMENT_EXAMPLE,
  type DemoDocumentType,
  type DemoUsage,
} from "@/lib/demo";
import {
  DemoDocumentLimitNotice,
  DemoExampleNotice,
} from "@/components/DemoNotices";

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
// Export helpers (browser-only, loaded lazily)
// ---------------------------------------------------------------------------

function sanitizeName(s: string) {
  return s
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

type GenerationProgressState = {
  stage: GenerationStage;
  percent: number;
  startedAt: number;
};

async function readGenerationStream(
  response: Response,
  onProgress: (stage: GenerationStage, percent: number) => void,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming is not supported by this browser.");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  const processLine = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line) as GenerationStreamEvent;
    if (event.type === "progress") onProgress(event.stage, event.percent);
    if (event.type === "content") content = event.content;
    if (event.type === "error") throw new Error(event.message);
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    lines.forEach(processLine);
  }
  buffer += decoder.decode();
  processLine(buffer);
  if (!content.trim()) throw new Error("Generation returned no content.");
  return content;
}

function GenerationProgressCard({ progress }: { progress: GenerationProgressState }) {
  const t = useTranslations("Workspace");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    const update = () => setElapsedSeconds(Math.floor((Date.now() - progress.startedAt) / 1000));
    update();
    const timer = setInterval(update, 1_000);
    return () => clearInterval(timer);
  }, [progress.startedAt]);

  const stageLabel: Record<GenerationStage, string> = {
    preparing: t("progressPreparing"),
    generating: t("progressGenerating"),
    validating: t("progressValidating"),
    finalizing: t("progressFinalizing"),
  };

  return (
    <div className="rounded-lg border border-border bg-background px-4 py-4" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-foreground">{stageLabel[progress.stage]}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {t("progressEstimate")}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">
          {t("progressElapsed", { seconds: elapsedSeconds })}
        </span>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-sm bg-muted"
        role="progressbar"
        aria-label={t("progressLabel")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
      >
        <div
          className="h-full rounded-sm bg-accent transition-[width] duration-700 ease-out"
          style={{ width: `${progress.percent}%` }}
        />
      </div>
      {elapsedSeconds >= 120 ? (
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("progressLongWait")}</p>
      ) : null}
    </div>
  );
}

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
    <div className={`rounded-xl border border-border bg-background p-3 min-h-[28rem] shadow-[var(--shadow-sm)] sm:p-6${isStreaming ? ' streaming' : ''}`}>
      {nodes}
    </div>
  );
}

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
      <div className="rounded-xl border border-border bg-background shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between border-b border-border px-3 py-3 sm:px-6">
          <span className="label-caps">{t("emailDraftHeader")}</span>
        </div>
        <div className="whitespace-pre-wrap p-3 text-sm leading-relaxed text-foreground sm:p-6">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-6 py-3">
        <span className="label-caps">{t("emailDraftHeader")}</span>
        <span className="text-xs text-muted-foreground">{t("emailSuggestionHint")}</span>
      </div>

      {parsed.subject && (
        <div className="grid grid-cols-[5rem_1fr] gap-4 border-b border-border px-3 py-3 sm:px-6 sm:py-4">
          <span className="label-caps pt-0.5">{t("emailSubjectLabel")}</span>
          <p className="font-display text-base leading-snug text-foreground">
            {parsed.subject}
          </p>
        </div>
      )}

      {parsed.body && (
        <div className="px-3 py-4 sm:px-6 sm:py-5">
          <p className="label-caps mb-3">{t("emailBodyLabel")}</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {parsed.body}
          </div>
        </div>
      )}

      {parsed.signature && (
        <div className="border-t border-border px-3 py-3 sm:px-6 sm:py-4">
          <p className="label-caps mb-2">{t("emailSignatureLabel")}</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {parsed.signature}
          </div>
        </div>
      )}

      {parsed.attachments.length > 0 && (
        <div className="border-t border-border bg-muted/30 px-3 py-3 sm:px-6 sm:py-4">
          <p className="label-caps mb-3">{t("emailAttachmentsLabel")}</p>
          <ul className="flex flex-col gap-2">
            {parsed.attachments.map((a, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-background px-2 py-0.5 text-xs text-foreground">
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
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-border bg-background shadow-sm">
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
                {v.style && (
                  <span className="capitalize font-medium">{v.style}</span>
                )}
                {v.style && " · "}
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

function docTypeToTabId(dt: DocumentType): string {
  if (dt === "tailored_resume") return "resume";
  if (dt === "cover_letter") return "cover_letter";
  if (dt === "email_draft") return "email";
  return dt;
}

// ---------------------------------------------------------------------------
// EvalResultsPanel — ATS + fabrication checks rendered below the resume
// ---------------------------------------------------------------------------

function EvalResultsPanel({
  ats,
  fabrication,
  loading,
}: {
  ats: ATSResult | null;
  fabrication: FabricationResult | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="mt-4 animate-pulse rounded-lg border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
        Analyzing resume…
      </div>
    );
  }

  if (!ats || !fabrication) return null;

  function scoreColor(n: number) {
    if (n >= 75) return "#346538";
    if (n >= 50) return "#956400";
    return "#9f2f2d";
  }

  const atsColor = scoreColor(ats.overall);
  const fabColor = scoreColor(fabrication.score);

  return (
    <div className="mt-4 space-y-3">
      {/* ATS Score Card */}
      <div className="surface-card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <p className="label-caps">ATS Score</p>
          <span className="text-base font-semibold tabular-nums" style={{ color: atsColor }}>
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
                  className="h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                {value}%
              </span>
            </div>
          ))}
        </div>

        {ats.matchedKeywords.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="text-success">✓</span>{" "}
            {ats.matchedKeywords.slice(0, 10).join(", ")}
            {ats.matchedKeywords.length > 10 && ` +${ats.matchedKeywords.length - 10} more`}
          </p>
        )}

        {ats.missingKeywords.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="text-[var(--warning)]">⚠</span>{" "}
            Missing: {ats.missingKeywords.slice(0, 6).join(", ")}
          </p>
        )}

        {ats.suggestions.length > 0 && (
          <div>
            <p className="label-caps mb-1">Tips</p>
            <ul className="space-y-1">
              {ats.suggestions.map((s, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="shrink-0">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Fabrication Check */}
      <div className="surface-card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <p className="label-caps">Fabrication Check</p>
          <span className="text-sm font-semibold tabular-nums" style={{ color: fabColor }}>
            {fabrication.score >= 90 ? "✓" : "⚠"} {fabrication.score}/100
          </span>
        </div>

        {fabrication.fabricatedClaims.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            All {fabrication.totalClaims} claims traced to source material.
          </p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {fabrication.fabricatedClaims.length} claim
              {fabrication.fabricatedClaims.length !== 1 ? "s" : ""} could not be
              verified against your resume:
            </p>
            <ul className="space-y-1.5">
              {fabrication.fabricatedClaims.slice(0, 5).map((c, i) => (
                <li
                  key={i}
                  className="rounded border border-[var(--warning-border)] bg-[var(--warning-light)] px-2.5 py-1.5 text-xs"
                >
                  <span className="text-[var(--warning)]">⚠ </span>
                  <span className="italic text-[var(--warning)]">
                    &ldquo;{c.claim.length > 90 ? c.claim.slice(0, 90) + "…" : c.claim}&rdquo;
                  </span>
                  <span className="text-[var(--warning)]/80"> — {c.reason}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function DocumentPanel({
  applicationId,
  documentType,
  existingDoc,
  hasResume,
  exportFilename,
  showEmail,
  demoUsed,
}: {
  applicationId: string;
  documentType: DocumentType;
  existingDoc: ApplicationDocument | null;
  hasResume: boolean;
  exportFilename: string;
  showEmail?: boolean;
  demoUsed?: number;
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
  const [evalResult, setEvalResult] = useState<{ ats: ATSResult; fabrication: FabricationResult } | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const sourcePreviewRef = useRef<SourceDocumentPreviewHandle>(null);
  const [sourceType, setSourceType] = useState<ResumeSourceType | null>(null);
  const [adjustText, setAdjustText] = useState("");
  const [adjusting, setAdjusting] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState | null>(null);
  const [quotaConsumed, setQuotaConsumed] = useState((demoUsed ?? 0) >= 1);
  const canAdjust = documentType === "tailored_resume" || documentType === "cover_letter";
  const isDemoLimited = demoUsed != null;

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

  async function streamGeneratedDocument(extraBody: Record<string, unknown>): Promise<string> {
    const res = await fetch("/api/generate-document", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        application_id: applicationId,
        document_type: documentType,
        ...extraBody,
      }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(json.error ?? t("generationFailed"));
    }

    const accumulated = await readGenerationStream(res, (stage, percent) => {
      setGenerationProgress((current) => ({
        stage,
        percent,
        startedAt: current?.startedAt ?? Date.now(),
      }));
    });
    setContent(accumulated);
    return accumulated;
  }

  async function runResumeEvalCheck(accumulated: string) {
    if (documentType !== "tailored_resume") return;
    setEvalLoading(true);
    try {
      const result = await runResumeEvals(applicationId, accumulated);
      setEvalResult(result);
    } catch {
      // Eval failure is non-fatal; resume is still usable
    } finally {
      setEvalLoading(false);
    }
  }

  async function handleGenerate() {
    if (isDemoLimited && quotaConsumed) return;
    setGenerateError("");
    setSaveStatus("idle");
    setContent("");
    setGenerating(true);
    setGenerationProgress({ stage: "preparing", percent: 4, startedAt: Date.now() });
    try {
      if (documentType === "tailored_resume" || documentType === "cover_letter") {
        await getApplicationResumeSourceAction(applicationId);
      }
      const accumulated = await streamGeneratedDocument({});
      if (isDemoLimited) setQuotaConsumed(true);
      await saveContent(accumulated);
      await runResumeEvalCheck(accumulated);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : t("generationFailed"));
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  }

  async function handleAdjust() {
    const instruction = adjustText.trim();
    if (!instruction || !content.trim() || (isDemoLimited && quotaConsumed)) return;
    setGenerateError("");
    setSaveStatus("idle");
    setAdjusting(true);
    setGenerationProgress({ stage: "preparing", percent: 4, startedAt: Date.now() });
    try {
      const accumulated = await streamGeneratedDocument({ adjust_instruction: instruction });
      if (isDemoLimited) setQuotaConsumed(true);
      await saveContent(accumulated);
      setAdjustText("");
      await runResumeEvalCheck(accumulated);
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : t("generationFailed"));
    } finally {
      setAdjusting(false);
      setGenerationProgress(null);
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
    setGenerateError("");
    try {
      if (!sourcePreviewRef.current) throw new Error(t("sourcePreviewUnavailable"));
      await sourcePreviewRef.current.download(format, exportFilename);
    } catch (error) {
      setGenerateError(error instanceof Error ? error.message : t("exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  if (showEmail) {
    // Email draft — styled copyable card, no download
    return (
      <div className="flex flex-col gap-4">
        {isDemoLimited ? (
          <DemoDocumentLimitNotice
            documentType={documentType as DemoDocumentType}
            used={quotaConsumed ? 1 : 0}
          />
        ) : null}
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
              disabled={generating || !hasResume || (isDemoLimited && quotaConsumed)}
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
        {generationProgress ? <GenerationProgressCard progress={generationProgress} /> : null}

        <div className="relative">
          {content ? (
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
        </div>

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
      {isDemoLimited ? (
        <DemoDocumentLimitNotice
          documentType={documentType as DemoDocumentType}
          used={quotaConsumed ? 1 : 0}
        />
      ) : null}
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
            disabled={generating || adjusting || !hasResume || (isDemoLimited && quotaConsumed)}
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
                disabled={exporting || !content.trim() || !sourceType}
                title={t("downloadPDF")}
              >
                {t("downloadPDF")}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("docx")}
                disabled={exporting || !content.trim() || !sourceType}
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
      {generationProgress ? <GenerationProgressCard progress={generationProgress} /> : null}

      <div className="relative">
        <SourceDocumentPreview
          ref={sourcePreviewRef}
          applicationId={applicationId}
          content={content}
          documentType={documentType === "cover_letter" ? "cover_letter" : "tailored_resume"}
          title={exportFilename}
          isGenerating={generating || adjusting}
          onSourceTypeChange={setSourceType}
        />
      </div>

      {canAdjust && docId && content && !generating && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={adjustText}
            onChange={(e) => setAdjustText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !adjusting && adjustText.trim()) {
                e.preventDefault();
                void handleAdjust();
              }
            }}
            placeholder={t("adjustPlaceholder")}
            disabled={adjusting || (isDemoLimited && quotaConsumed)}
            className="input min-w-0 flex-1"
          />
          <Button
            variant="outline"
            onClick={handleAdjust}
            disabled={adjusting || !adjustText.trim() || (isDemoLimited && quotaConsumed)}
          >
            {adjusting ? (
              <span className="flex items-center gap-1.5">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
                {t("adjusting")}
              </span>
            ) : t("adjustButton")}
          </Button>
        </div>
      )}

      {documentType === "tailored_resume" && (evalLoading || evalResult) && (
        <EvalResultsPanel
          ats={evalResult?.ats ?? null}
          fabrication={evalResult?.fabrication ?? null}
          loading={evalLoading}
        />
      )}

      {docId && content && !generating && !adjusting && (
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

function AssessmentPanel({ applicationId, isDemo }: { applicationId: string; isDemo?: boolean }) {
  const t = useTranslations("Workspace");
  const demoT = useTranslations("Demo");
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
      try {
        const res = await analyzeAssessmentAction(undefined, fd);
        if (res && "error" in res && res.error) {
          setError(res.error);
        } else if (res && "result" in res && res.result) {
          setResult(res.result);
        }
      } catch {
        setError("Analysis failed. Please try again.");
      }
    });
  }

  if (isDemo) {
    return (
      <div className="flex flex-col gap-4">
        <DemoExampleNotice title={demoT("assessmentTitle")}>
          {demoT("assessmentBody")}
        </DemoExampleNotice>
        <AssessmentResults result={DEMO_ASSESSMENT_EXAMPLE} />
      </div>
    );
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
// InterviewPrepViewer — accordion for ### Q: blocks, regular markdown elsewhere
// ---------------------------------------------------------------------------

function InterviewPrepViewer({ content, isStreaming }: { content: string; isStreaming?: boolean }) {
  const t = useTranslations("Workspace");

  if (!content.trim()) {
    return (
      <p className="text-sm text-muted-foreground italic">{t("noContent")}</p>
    );
  }

  // During streaming show plain markdown so in-progress content is visible
  if (isStreaming) {
    return <MarkdownViewer content={content} isStreaming />;
  }

  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let nodeKey = 0;
  const nk = () => nodeKey++;

  let mainList: string[] = [];
  let inQ = false;
  let qText = "";
  let qBody: React.ReactNode[] = [];
  let qList: string[] = [];

  function flushMainList() {
    if (!mainList.length) return;
    const items = [...mainList];
    mainList = [];
    nodes.push(
      <ul key={nk()} className="my-1 space-y-0.5 pl-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <span>{applyInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
  }

  function flushQList() {
    if (!qList.length) return;
    const items = [...qList];
    qList = [];
    qBody.push(
      <ul key={nk()} className="my-1 space-y-0.5 pl-4">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
            <span>{applyInline(item)}</span>
          </li>
        ))}
      </ul>,
    );
  }

  function commitQ() {
    if (!inQ) return;
    flushQList();
    const body = [...qBody];
    const question = qText;
    nodes.push(
      <details key={nk()} className="group mb-2 overflow-hidden rounded-md border border-border">
        <summary className="flex cursor-pointer select-none list-none items-start gap-2 px-4 py-3 text-sm font-medium hover:bg-muted/40">
          <span className="mt-0.5 shrink-0 text-[10px] text-muted-foreground transition-transform duration-150 group-open:rotate-90">▶</span>
          <span>{question}</span>
        </summary>
        <div className="border-t border-border px-4 py-3">{body}</div>
      </details>,
    );
    inQ = false;
    qText = "";
    qBody = [];
    qList = [];
  }

  for (const line of lines) {
    if (line.startsWith("### Q:")) {
      if (inQ) commitQ();
      else flushMainList();
      inQ = true;
      qText = line.slice(6).trim();
      continue;
    }

    if (inQ) {
      if (line.startsWith("## ") || line.startsWith("# ")) {
        commitQ();
        // fall through to main rendering below
      } else if (line.startsWith("- ") || line.startsWith("* ")) {
        qList.push(line.slice(2));
        continue;
      } else if (line.trim() === "") {
        flushQList();
        qBody.push(<div key={nk()} className="h-1" />);
        continue;
      } else {
        flushQList();
        qBody.push(
          <p key={nk()} className="text-sm leading-relaxed">
            {applyInline(line)}
          </p>,
        );
        continue;
      }
    }

    if (line.startsWith("# ")) {
      flushMainList();
      nodes.push(
        <h1 key={nk()} className="font-display text-2xl leading-tight mt-2 mb-1">
          {line.slice(2)}
        </h1>,
      );
    } else if (line.startsWith("## ")) {
      flushMainList();
      nodes.push(
        <h2 key={nk()} className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-5 mb-1.5 border-b border-border pb-1">
          {line.slice(3)}
        </h2>,
      );
    } else if (line.startsWith("### ")) {
      flushMainList();
      nodes.push(
        <h3 key={nk()} className="text-sm font-semibold mt-3 mb-1">
          {line.slice(4)}
        </h3>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      mainList.push(line.slice(2));
    } else if (line.trim() === "") {
      flushMainList();
      nodes.push(<div key={nk()} className="h-1.5" />);
    } else {
      flushMainList();
      nodes.push(
        <p key={nk()} className="text-sm leading-relaxed">
          {applyInline(line)}
        </p>,
      );
    }
  }

  if (inQ) commitQ();
  else flushMainList();

  return (
    <div className="min-h-[28rem] rounded-xl border border-border bg-background p-3 shadow-[var(--shadow-sm)] sm:p-6">
      {nodes}
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
  demoUsed,
}: {
  applicationId: string;
  hasResume: boolean;
  existingDoc: ApplicationDocument | null;
  demoUsed?: number;
}) {
  const t = useTranslations("Workspace");
  const [content, setContent] = useState(existingDoc?.text_content ?? "");
  const [docId, setDocId] = useState(existingDoc?.id ?? "");
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [autoSaving, setAutoSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState | null>(null);
  const [quotaConsumed, setQuotaConsumed] = useState((demoUsed ?? 0) >= 1);
  const isDemoLimited = demoUsed != null;

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
    if (isDemoLimited && quotaConsumed) return;
    setError("");
    setSaveStatus("idle");
    setContent("");
    setGenerating(true);
    setGenerationProgress({ stage: "preparing", percent: 4, startedAt: Date.now() });
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

      const accumulated = await readGenerationStream(res, (stage, percent) => {
        setGenerationProgress((current) => ({
          stage,
          percent,
          startedAt: current?.startedAt ?? Date.now(),
        }));
      });
      setContent(accumulated);
      if (isDemoLimited) setQuotaConsumed(true);
      await saveContent(accumulated);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("generationFailed"));
    } finally {
      setGenerating(false);
      setGenerationProgress(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {isDemoLimited ? (
        <DemoDocumentLimitNotice
          documentType="interview_prep"
          used={quotaConsumed ? 1 : 0}
        />
      ) : null}
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
          disabled={generating || !hasResume || (isDemoLimited && quotaConsumed)}
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
      {generationProgress ? <GenerationProgressCard progress={generationProgress} /> : null}

      <div className="relative">
        <InterviewPrepViewer content={content} isStreaming={generating} />
      </div>
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
  sourceResumeTitle,
  statusLabel,
  isDemo = false,
  demoDocumentUsage,
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
  sourceResumeTitle?: string;
  statusLabel?: string;
  isDemo?: boolean;
  demoDocumentUsage?: DemoUsage["documents"];
}) {
  const t = useTranslations("Workspace");
  const [activeTab, setActiveTabState] = useState<TabId>("resume");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = sessionStorage.getItem(`workspace-tab-${applicationId}`);
      if (saved && TABS.some((t) => t.id === saved)) {
        setActiveTabState(saved as TabId);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [applicationId]);

  function setActiveTab(tab: TabId) {
    sessionStorage.setItem(`workspace-tab-${applicationId}`, tab);
    setActiveTabState(tab);
  }

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
    <div className="surface-card overflow-hidden">
      <div className="border-b border-border px-5 py-5 text-center sm:px-6">
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight">
            {roleTitle || t("workspaceUntitledRole")}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {companyName || t("workspaceUnknownCompany")}
          </p>
          {sourceResumeTitle ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {t("sourceResumeLabel")}: <span className="font-medium text-foreground">{sourceResumeTitle}</span>
            </p>
          ) : null}
        </div>
        {statusLabel ? (
          <span className="badge badge-saved mt-3">{statusLabel}</span>
        ) : null}
      </div>

      <nav className="overflow-x-auto border-b border-border bg-canvas px-4 py-4" aria-label={activeLabel}>
        <div className="flex min-w-max justify-center sm:min-w-0" role="tablist">
          <div className="segmented-control">
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDone = tab.docType ? documentStatus[tab.docType] : false;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={[
                    "segmented-control-item gap-1.5",
                    isActive ? "segmented-control-item-active" : "",
                  ].join(" ")}
                  role="tab"
                  aria-selected={isActive}
                >
                  {isDone ? <span className="text-accent" aria-hidden="true">✓</span> : null}
                  <span>{t(tab.shortLabelKey)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

        <section className="min-h-[40rem] min-w-0 p-4 sm:p-6 md:p-8" role="tabpanel">
          <p className="label-caps mb-5 text-muted-foreground">{activeLabel}</p>
          {activeTab === "resume" && (
            <>
              <DocumentPanel
                applicationId={applicationId}
                documentType="tailored_resume"
                existingDoc={documents.tailored_resume}
                hasResume={hasResume}
                exportFilename={resumeFilename}
                demoUsed={demoDocumentUsage?.tailored_resume}
              />
            </>
          )}
          {activeTab === "cover_letter" && (
            <DocumentPanel
              applicationId={applicationId}
              documentType="cover_letter"
              existingDoc={documents.cover_letter}
              hasResume={hasResume}
              exportFilename={coverFilename}
              demoUsed={demoDocumentUsage?.cover_letter}
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
              demoUsed={demoDocumentUsage?.email_draft}
            />
          )}
          {activeTab === "assessment" && (
            <AssessmentPanel applicationId={applicationId} isDemo={isDemo} />
          )}
          {activeTab === "interview_prep" && (
            <InterviewPrepPanel
              applicationId={applicationId}
              hasResume={hasResume}
              existingDoc={documents.interview_prep}
              demoUsed={demoDocumentUsage?.interview_prep}
            />
          )}
        </section>
    </div>
  );
}
