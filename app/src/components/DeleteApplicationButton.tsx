"use client";

import { useState, useTransition } from "react";
import { deleteApplicationAction } from "@/app/actions/applications";

export function DeleteApplicationButton({
  applicationId,
  variant = "icon",
}: {
  applicationId: string;
  variant?: "icon" | "text";
}) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startDelete] = useTransition();

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", applicationId);
    startDelete(() => deleteApplicationAction(fd));
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">Delete this application?</span>
        <button
          onClick={handleDelete}
          disabled={pending}
          className="rounded px-2 py-1 text-xs font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs border border-border hover:bg-muted"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (variant === "text") {
    return (
      <button
        onClick={(e) => { e.preventDefault(); setConfirming(true); }}
        className="rounded-md border border-border px-3 py-1.5 text-xs text-danger hover:bg-muted"
      >
        Delete application
      </button>
    );
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); setConfirming(true); }}
      title="Delete application"
      className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground hover:border-danger/50 hover:text-danger hover:bg-muted"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    </button>
  );
}
