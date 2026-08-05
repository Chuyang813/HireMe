"use client";

import { useTranslations } from "next-intl";
import {
  DEMO_APPLICATION_LIMIT,
  demoDocumentRemaining,
  type DemoDocumentType,
  type DemoUsage,
} from "@/lib/demo";

const DOCUMENT_KEYS: Record<DemoDocumentType, string> = {
  tailored_resume: "resumeLabel",
  cover_letter: "coverLetterLabel",
  email_draft: "emailLabel",
  interview_prep: "interviewLabel",
};

export function DemoUsageBanner({ usage }: { usage: DemoUsage }) {
  const t = useTranslations("Demo");
  return (
    <aside className="surface-card border-accent/25 bg-[var(--accent-light)] p-4" aria-label={t("usageTitle")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label-caps text-accent">{t("usageTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("usageBody")}</p>
        </div>
        <span className="badge badge-saved">{t("badge")}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="rounded-md border border-border bg-background px-2.5 py-1.5">
          {t("applicationsUsage", { used: usage.applications, limit: DEMO_APPLICATION_LIMIT })}
        </span>
        {DEMO_DOCUMENT_TYPES_FOR_DISPLAY.map((type) => (
          <span key={type} className="rounded-md border border-border bg-background px-2.5 py-1.5">
            {t("generationRemaining", {
              label: t(DOCUMENT_KEYS[type]),
              remaining: demoDocumentRemaining(usage, type),
            })}
          </span>
        ))}
      </div>
    </aside>
  );
}

const DEMO_DOCUMENT_TYPES_FOR_DISPLAY: DemoDocumentType[] = [
  "tailored_resume",
  "cover_letter",
  "email_draft",
  "interview_prep",
];

export function DemoDocumentLimitNotice({
  documentType,
  used,
}: {
  documentType: DemoDocumentType;
  used: number;
}) {
  const t = useTranslations("Demo");
  const remaining = Math.max(0, 1 - used);
  return (
    <div className="rounded-lg border border-accent/25 bg-[var(--accent-light)] px-3.5 py-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-accent">{t("documentAllowance", { label: t(DOCUMENT_KEYS[documentType]) })}</strong>
        <span className="badge badge-saved">{t("oneUse", { remaining })}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {remaining > 0 ? t("documentAvailable") : t("documentUsed")}
      </p>
    </div>
  );
}

export function DemoExampleNotice({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("Demo");
  return (
    <aside className="surface-card border-accent/25 bg-[var(--accent-light)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="label-caps text-accent">{title}</p>
          <div className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</div>
        </div>
        <span className="badge badge-saved shrink-0">{t("exampleBadge")}</span>
      </div>
    </aside>
  );
}
