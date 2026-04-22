"use client";

import { useState, useTransition } from "react";
import {
  saveDocumentAction,
  analyzeAssessmentAction,
  generateInterviewPrepAction,
  scoreResumeAction,
  getDocumentVersionsAction,
  type DocumentVersion,
} from "@/app/actions/ai";
import { updateNotesAction } from "@/app/actions/applications";
import { Button } from "@/components/ui/Button";
import type {
  ApplicationDocument,
  AssessmentAnalysis,
  DocumentType,
  InterviewPrep,
  ResumeScore,
} from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

type TabId =
  | "resume"
  | "cover_letter"
  | "email"
  | "notes"
  | "assessment"
  | "interview_prep";

const TABS: { id: TabId; label: string }[] = [
  { id: "resume", label: "Resume" },
  { id: "cover_letter", label: "Cover letter" },
  { id: "email", label: "Email draft" },
  { id: "notes", label: "Notes" },
  { id: "assessment", label: "Assessment" },
  { id: "interview_prep", label: "Interview prep" },
];

// ---------------------------------------------------------------------------
// Export helpers (browser-only, loaded lazily)
// ---------------------------------------------------------------------------

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

async function exportPDF(content: string, filename: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 18;
  const maxW = pageW - margin * 2;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const lines = doc.splitTextToSize(content, maxW) as string[];
  const lineH = 5;
  let y = margin;
  for (const line of lines) {
    if (y + lineH > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineH;
  }
  doc.save(`${filename}.pdf`);
}

async function exportDOCX(content: string, filename: string) {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs = content.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun({ text: line, font: "Calibri", size: 22 })],
        spacing: { after: 120 },
      }),
  );
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
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
        History
      </Button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-sm border border-border bg-background shadow-md">
          {loading && <p className="px-4 py-3 text-sm text-muted-foreground">Loading…</p>}
          {error && <p className="px-4 py-3 text-sm text-danger">{error}</p>}
          {!loading && !error && versions.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">No previous versions.</p>
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
// DocumentPanel — streaming AI generation + copy + save + export
// ---------------------------------------------------------------------------

function DocumentPanel({
  applicationId,
  documentType,
  existingDoc,
  hasResume,
  exportFilename,
}: {
  applicationId: string;
  documentType: DocumentType;
  existingDoc: ApplicationDocument | null;
  hasResume: boolean;
  exportFilename: string;
}) {
  const [content, setContent] = useState(existingDoc?.text_content ?? "");
  const [docId, setDocId] = useState(existingDoc?.id ?? "");
  const [generateError, setGenerateError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saving, startSave] = useTransition();
  const [exporting, setExporting] = useState(false);

  async function handleGenerate() {
    setGenerateError("");
    setContent("");
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          document_type: documentType,
        }),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({})) as { error?: string };
        setGenerateError(json.error ?? "Generation failed.");
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setGenerateError("Streaming not supported by this browser.");
        return;
      }

      const decoder = new TextDecoder();
      let accumulated = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setContent(accumulated);
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed.");
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

  function handleSave() {
    setSaveStatus("idle");
    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("document_type", documentType);
    fd.set("content", content);
    if (docId) fd.set("document_id", docId);
    startSave(async () => {
      const result = await saveDocumentAction(undefined, fd);
      if (result && "ok" in result && result.ok) {
        setDocId(result.documentId);
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    });
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

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hasResume && (
          <p className="text-sm text-muted-foreground">
            Upload a base resume in{" "}
            <a href="/resumes" className="underline underline-offset-2">
              Resumes
            </a>{" "}
            to enable AI generation.
          </p>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating || !hasResume}
          >
            {generating ? "Generating…" : "Generate with AI"}
          </Button>
          {docId && (
            <HistoryDropdown
              documentId={docId}
              onRestore={(restored) => {
                setContent(restored);
                setSaveStatus("idle");
              }}
            />
          )}
          {content && (
            <>
              <Button variant="outline" onClick={handleCopy} disabled={!content}>
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("pdf")}
                disabled={exporting || !content.trim()}
                title="Download as PDF"
              >
                PDF ↓
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport("docx")}
                disabled={exporting || !content.trim()}
                title="Download as Word document"
              >
                DOCX ↓
              </Button>
            </>
          )}
          <Button onClick={handleSave} disabled={saving || !content.trim()}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {generateError ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {generateError}
        </p>
      ) : null}

      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value);
          setSaveStatus("idle");
        }}
        className="min-h-[28rem] w-full rounded-sm border border-border bg-background p-4 font-mono text-xs outline-none focus:border-foreground"
        placeholder="Click 'Generate with AI' or write directly…"
      />

      {saveStatus === "saved" && (
        <p className="text-xs text-[var(--success)]">Saved.</p>
      )}
      {saveStatus === "error" && (
        <p className="text-xs text-danger">Save failed. Please try again.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NotesPanel
// ---------------------------------------------------------------------------

function NotesPanel({
  applicationId,
  initialNotes,
}: {
  applicationId: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [saving, startSave] = useTransition();

  function handleSave() {
    setSaveStatus("idle");
    const fd = new FormData();
    fd.set("application_id", applicationId);
    fd.set("notes", notes);
    startSave(async () => {
      await updateNotesAction(fd);
      setSaveStatus("saved");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save notes"}
        </Button>
      </div>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          setSaveStatus("idle");
        }}
        className="min-h-[28rem] w-full rounded-sm border border-border bg-background p-4 text-sm outline-none focus:border-foreground"
        placeholder="Add your notes, follow-up tasks, contacts, or anything else…"
      />
      {saveStatus === "saved" && (
        <p className="text-xs text-[var(--success)]">Saved.</p>
      )}
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
  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-sm border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="label-caps mb-1.5">Summary</p>
            <p className="text-sm leading-relaxed">{result.summary}</p>
          </div>
          {result.estimated_effort_hours != null && (
            <span className="shrink-0 rounded-sm border border-border px-2 py-0.5 text-xs text-muted-foreground">
              ~{result.estimated_effort_hours}h
            </span>
          )}
        </div>
      </div>

      {result.deliverables?.length ? (
        <div>
          <p className="label-caps mb-2">Deliverables</p>
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
          <p className="label-caps mb-2">Likely evaluation criteria</p>
          <ul className="space-y-1">
            {result.evaluation_criteria.map((c, i) => (
              <li key={i} className="text-sm text-muted-foreground">
                — {c}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <AssessmentChecklist items={result.preparation_steps ?? []} label="Preparation steps" />
      <AssessmentChecklist items={result.checklist ?? []} label="Key checklist" />
    </div>
  );
}

function AssessmentPanel({ applicationId }: { applicationId: string }) {
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
        Upload the take-home or assessment brief and Claude will break it down
        for you.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 rounded-sm border border-border px-4 py-2.5 text-sm hover:bg-muted">
          <span>{file ? file.name : "Choose file…"}</span>
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
          {analyzing ? "Analyzing…" : "Analyze"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {result ? <AssessmentResults result={result} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InterviewPrepPanel
// ---------------------------------------------------------------------------

const CATEGORY_LABEL: Record<string, string> = {
  behavioral: "Behavioral",
  technical: "Technical",
  role_specific: "Role-specific",
  company: "Company",
};

function QuestionCard({
  q,
  isOpen,
  onToggle,
}: {
  q: InterviewPrep["likely_questions"][number];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-sm border border-border">
      <button
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium leading-snug">{q.question}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {CATEGORY_LABEL[q.category] ?? q.category}
          </p>
        </div>
        <span className="mt-0.5 shrink-0 text-muted-foreground text-xs">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div className="border-t border-border px-4 py-3">
          {q.star_answer ? (
            <>
              <p className="label-caps mb-2">Suggested answer</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {q.star_answer}
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No suggested answer for this question type.
            </p>
          )}
          {q.rationale && (
            <p className="mt-3 text-xs text-muted-foreground">
              Why asked: {q.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function InterviewPrepPanel({
  applicationId,
  hasResume,
}: {
  applicationId: string;
  hasResume: boolean;
}) {
  const [result, setResult] = useState<InterviewPrep | null>(null);
  const [error, setError] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [generating, startGenerate] = useTransition();

  function handleGenerate() {
    setError("");
    const fd = new FormData();
    fd.set("application_id", applicationId);
    startGenerate(async () => {
      const res = await generateInterviewPrepAction(undefined, fd);
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else if (res && "result" in res && res.result) {
        setResult(res.result);
        setExpandedIdx(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hasResume && (
          <p className="text-sm text-muted-foreground">
            Upload a base resume in{" "}
            <a href="/resumes" className="underline underline-offset-2">
              Resumes
            </a>{" "}
            to enable AI generation.
          </p>
        )}
        <Button
          onClick={handleGenerate}
          disabled={generating || !hasResume}
          className="ml-auto"
        >
          {generating ? "Generating…" : "Generate Interview Prep"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {result && (
        <div className="space-y-6">
          <div>
            <p className="label-caps mb-3">Likely questions</p>
            <div className="space-y-2">
              {result.likely_questions.map((q, i) => (
                <QuestionCard
                  key={i}
                  q={q}
                  isOpen={expandedIdx === i}
                  onToggle={() =>
                    setExpandedIdx(expandedIdx === i ? null : i)
                  }
                />
              ))}
            </div>
          </div>

          {result.preparation_checklist?.length ? (
            <div>
              <p className="label-caps mb-2">Preparation checklist</p>
              <ul className="space-y-1.5">
                {result.preparation_checklist.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-0.5 shrink-0 text-muted-foreground">
                      ◻
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.talking_points?.length ? (
            <div>
              <p className="label-caps mb-2">Key talking points</p>
              <ul className="space-y-1">
                {result.talking_points.map((tp, i) => (
                  <li key={i} className="text-sm text-muted-foreground">
                    — {tp}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScoreCard — resume vs job match
// ---------------------------------------------------------------------------

function scoreColor(score: number) {
  if (score >= 75) return "var(--color-success, #34d399)";
  if (score >= 50) return "#f59e0b";
  return "var(--color-danger, #f87171)";
}

function ScoreCard({ result }: { result: ResumeScore }) {
  const color = scoreColor(result.score);
  return (
    <div className="mt-4 rounded-sm border border-border bg-background p-5 space-y-5">
      <div className="flex items-center gap-5">
        <div
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 text-xl font-bold"
          style={{ borderColor: color, color }}
        >
          {result.score}
        </div>
        <div>
          <p className="label-caps text-muted-foreground mb-0.5">Match score</p>
          <div className="h-2 w-48 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${result.score}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>

      {result.strengths?.length ? (
        <div>
          <p className="label-caps mb-2">Strengths</p>
          <ul className="space-y-1">
            {result.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="mt-0.5 shrink-0" style={{ color: "#34d399" }}>✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.gaps?.length ? (
        <div>
          <p className="label-caps mb-2">Gaps</p>
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
          <p className="label-caps mb-2">Top suggestions</p>
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
  const [scoreResult, setScoreResult] = useState<ResumeScore | null>(null);
  const [error, setError] = useState("");
  const [scoring, startScore] = useTransition();

  function handleScore() {
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
          onClick={handleScore}
          disabled={scoring || !hasResume}
        >
          {scoring ? "Scoring…" : "Score Resume"}
        </Button>
        {!hasResume && (
          <p className="text-sm text-muted-foreground">
            Upload a base resume to enable scoring.
          </p>
        )}
      </div>
      {error ? (
        <p className="mt-3 rounded-sm border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {scoreResult ? <ScoreCard result={scoreResult} /> : null}
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
  notes,
  companyName,
  roleTitle,
}: {
  applicationId: string;
  hasResume: boolean;
  documents: {
    tailored_resume: ApplicationDocument | null;
    cover_letter: ApplicationDocument | null;
    email_draft: ApplicationDocument | null;
  };
  notes: string;
  companyName?: string;
  roleTitle?: string;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("resume");

  const base = slugify(`${companyName ?? "company"}-${roleTitle ?? "role"}`);

  return (
    <div>
      <div className="flex flex-wrap gap-0 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-foreground font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === "resume" && (
          <>
            <DocumentPanel
              applicationId={applicationId}
              documentType="tailored_resume"
              existingDoc={documents.tailored_resume}
              hasResume={hasResume}
              exportFilename={`resume-${base}`}
            />
            <div className="mt-6 border-t border-border pt-6">
              <p className="label-caps mb-1">Resume scoring</p>
              <p className="text-xs text-muted-foreground mb-3">
                Compare your base resume against this job description.
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
            exportFilename={`cover-letter-${base}`}
          />
        )}
        {activeTab === "email" && (
          <DocumentPanel
            applicationId={applicationId}
            documentType="email_draft"
            existingDoc={documents.email_draft}
            hasResume={hasResume}
            exportFilename={`email-${base}`}
          />
        )}
        {activeTab === "notes" && (
          <NotesPanel applicationId={applicationId} initialNotes={notes} />
        )}
        {activeTab === "assessment" && (
          <AssessmentPanel applicationId={applicationId} />
        )}
        {activeTab === "interview_prep" && (
          <InterviewPrepPanel
            applicationId={applicationId}
            hasResume={hasResume}
          />
        )}
      </div>
    </div>
  );
}
