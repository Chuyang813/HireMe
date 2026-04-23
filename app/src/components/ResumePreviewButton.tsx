"use client";

import { useState, useTransition } from "react";
import { getResumePreviewAction } from "@/app/(app)/resumes/actions";

export function ResumePreviewButton({ resumeId, title }: { resumeId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<
    | { type: "pdf"; url: string }
    | { type: "docx"; html: string }
    | { type: "txt"; text: string }
    | { error: string }
    | null
  >(null);
  const [loading, startLoad] = useTransition();

  function handleOpen() {
    setOpen(true);
    if (preview) return;
    startLoad(async () => {
      const result = await getResumePreviewAction(resumeId);
      setPreview(result);
    });
  }

  return (
    <>
      <button
        onClick={handleOpen}
        title="Preview resume"
        className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-1.5"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12S5 4 12 4s11 8 11 8-4 8-11 8S1 12 1 12z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
        Preview
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="relative flex h-[90vh] w-full max-w-3xl flex-col rounded-lg bg-background shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-5 py-3 shrink-0">
              <h2 className="font-display text-lg truncate">{title}</h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-muted text-muted-foreground"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <div className="flex-1 overflow-auto">
              {loading && (
                <div className="flex h-full items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-accent" />
                </div>
              )}

              {!loading && preview && (() => {
                if ("error" in preview) {
                  return <div className="p-6 text-sm text-danger">{preview.error}</div>;
                }
                if (preview.type === "pdf") {
                  return (
                    <iframe
                      src={preview.url}
                      className="h-full w-full border-0"
                      title={title}
                    />
                  );
                }
                if (preview.type === "docx") {
                  return (
                    <div
                      className="prose prose-sm max-w-none p-8"
                      dangerouslySetInnerHTML={{ __html: preview.html }}
                    />
                  );
                }
                return (
                  <pre className="whitespace-pre-wrap p-8 text-sm leading-relaxed font-mono">
                    {preview.text}
                  </pre>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
