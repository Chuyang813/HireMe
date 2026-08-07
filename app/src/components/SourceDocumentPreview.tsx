"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { useTranslations } from "next-intl";
import { getApplicationResumeSourceAction } from "@/app/actions/ai";
import { downloadBlob } from "@/lib/documents/application-pdf";
import {
  createSourceFormattedArtifact,
  docxPreviewToPdf,
  renderDocxPreview,
  type ResumeSourceType,
  type SourceFormattedArtifact,
} from "@/lib/documents/source-document";

export interface SourceDocumentPreviewHandle {
  download: (format: "pdf" | "docx", filename: string) => Promise<void>;
}

export const SourceDocumentPreview = forwardRef<
  SourceDocumentPreviewHandle,
  {
    applicationId: string;
    content: string;
    documentType: "tailored_resume" | "cover_letter";
    title: string;
    isGenerating: boolean;
    onSourceTypeChange?: (sourceType: ResumeSourceType | null) => void;
  }
>(function SourceDocumentPreview({
  applicationId,
  content,
  documentType,
  title,
  isGenerating,
  onSourceTypeChange,
}, ref) {
  const t = useTranslations("Workspace");
  const docxContainerRef = useRef<HTMLDivElement>(null);
  const [artifact, setArtifact] = useState<SourceFormattedArtifact | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [previewWarning, setPreviewWarning] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!content.trim() || isGenerating) {
      setArtifact(null);
      setPreviewUrl("");
      setPreviewError("");
      setPreviewWarning("");
      setPreviewLoading(false);
      onSourceTypeChange?.(null);
      return;
    }

    let active = true;
    let objectUrl = "";
    setArtifact(null);
    setPreviewUrl("");
    setPreviewError("");
    setPreviewWarning("");
    setPreviewLoading(true);

    void getApplicationResumeSourceAction(applicationId)
      .then(async (source) => {
        if (!source.ok) throw new Error(source.error);
        const nextArtifact: SourceFormattedArtifact = await createSourceFormattedArtifact({
          sourceType: source.sourceType,
          sourceUrl: source.url,
          rawSourceText: source.rawText,
          content,
          documentType,
          title,
        });
        if (!active) return;
        if (nextArtifact.pdfBlob) {
          objectUrl = URL.createObjectURL(nextArtifact.pdfBlob);
          setPreviewUrl(objectUrl);
        }
        setArtifact(nextArtifact);
        onSourceTypeChange?.(nextArtifact.sourceType);
      })
      .catch((error: unknown) => {
        if (active) {
          setPreviewError(error instanceof Error ? error.message : t("sourcePreviewUnavailable"));
          onSourceTypeChange?.(null);
        }
      })
      .finally(() => {
        if (active) setPreviewLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [applicationId, content, documentType, isGenerating, onSourceTypeChange, t, title]);

  useEffect(() => {
    if (!artifact?.docxBlob || !docxContainerRef.current) return;
    let active = true;
    void renderDocxPreview(artifact.docxBlob, docxContainerRef.current)
      .catch((error: unknown) => {
        if (active) {
          setPreviewError(error instanceof Error ? error.message : t("sourcePreviewUnavailable"));
        }
      })
    return () => {
      active = false;
    };
  }, [artifact?.docxBlob, t]);

  useImperativeHandle(ref, () => ({
    async download(format, filename) {
      if (!artifact) throw new Error(t("sourcePreviewUnavailable"));
      if (format === "docx") {
        if (!artifact.docxBlob) throw new Error(t("sourceFormatOnly"));
        downloadBlob(artifact.docxBlob, `${filename}.docx`);
        return;
      }
      if (artifact.pdfBlob) {
        downloadBlob(artifact.pdfBlob, `${filename}.pdf`);
        return;
      }
      if (artifact.docxBlob && docxContainerRef.current) {
        const pdf = await docxPreviewToPdf(docxContainerRef.current, title);
        downloadBlob(pdf, `${filename}.pdf`);
        return;
      }
      throw new Error(t("sourcePreviewUnavailable"));
    },
  }), [artifact, t, title]);

  if (isGenerating || previewLoading) {
    return (
      <div className="flex min-h-[40rem] items-center justify-center rounded-xl border border-border bg-muted/20">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="h-4 w-4 animate-spin rounded-full border border-current border-t-transparent" />
          {isGenerating ? t("generating") : t("sourcePreviewLoading")}
        </div>
      </div>
    );
  }

  if (!content.trim()) {
    return (
      <div className="flex min-h-[40rem] items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 text-center">
        <p className="text-sm italic text-muted-foreground">{t("noContent")}</p>
      </div>
    );
  }

  if (previewError) {
    return (
      <div className="flex min-h-[40rem] items-center justify-center rounded-xl border border-danger/30 bg-danger/5 px-6 text-center">
        <p className="max-w-lg text-sm text-danger">{previewError}</p>
      </div>
    );
  }

  if (artifact?.previewType === "docx") {
    return (
      <div className="space-y-3">
        {previewWarning ? (
          <p className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] px-4 py-3 text-sm text-[var(--warning)]">
            {previewWarning}
          </p>
        ) : null}
        <div className="source-docx-shell overflow-auto rounded-xl border border-border bg-muted/40 p-3 shadow-[var(--shadow-sm)] sm:p-5">
          <div ref={docxContainerRef} aria-label={`${title} ${t("sourcePreviewLabel")}`} />
        </div>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className="space-y-3">
        {previewWarning ? (
          <p className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] px-4 py-3 text-sm text-[var(--warning)]">
            {previewWarning}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-border bg-muted/30 shadow-[var(--shadow-sm)]">
          <iframe
            src={previewUrl}
            title={`${title} ${t("sourcePreviewLabel")}`}
            className="h-[75vh] min-h-[42rem] w-full bg-white"
          />
        </div>
      </div>
    );
  }

  return null;
});
