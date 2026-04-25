"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { deleteApplicationAction } from "@/app/actions/applications";

export function DeleteApplicationButton({
  applicationId,
  variant = "icon",
}: {
  applicationId: string;
  variant?: "icon" | "text";
}) {
  const t = useTranslations("Applications");
  const [confirming, setConfirming] = useState(false);
  const [pending, startDelete] = useTransition();

  function handleDelete() {
    const fd = new FormData();
    fd.set("id", applicationId);
    startDelete(() => deleteApplicationAction(fd));
  }

  const buttonClass =
    variant === "text"
      ? "inline-flex h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-sm font-medium text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-50"
      : "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-white text-muted-foreground shadow-sm transition hover:border-red-300 hover:bg-red-50 hover:text-red-700";

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setConfirming((v) => !v);
        }}
        title={t("deleteApplication")}
        aria-label={t("deleteApplication")}
        className={buttonClass}
      >
        <TrashIcon />
        {variant === "text" && <span>{t("deleteApplication")}</span>}
      </button>

      {confirming && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-64 rounded-md border border-border bg-background p-3 text-left shadow-lg">
          <p className="mb-3 text-sm font-medium text-foreground">
            {t("deleteConfirm")}
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-8 rounded-md border border-border px-3 text-xs font-medium hover:bg-muted"
            >
              {t("deleteCancel")}
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={pending}
              className="h-8 rounded-md bg-red-600 px-3 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? t("deleting") : t("deleteYes")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}
