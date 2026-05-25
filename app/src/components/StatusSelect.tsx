"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { updateStatusAction } from "@/app/actions/applications";
import { APPLICATION_STATUSES } from "@/lib/db/types";
import type { ApplicationStatus } from "@/lib/db/types";

const STATUS_LABEL_KEYS: Record<ApplicationStatus, string> = {
  saved: "statusSaved",
  ready_to_apply: "statusReadyToApply",
  applied: "statusApplied",
  assessment: "statusAssessment",
  interview: "statusInterview",
  rejected: "statusRejected",
  offer: "statusOffer",
  withdrawn: "statusWithdrawn",
};

const STATUS_TONES: Record<ApplicationStatus, string> = {
  saved: "border-border bg-muted text-muted-foreground",
  ready_to_apply: "border-[var(--warning)] bg-[var(--warning-light)] text-[var(--warning)]",
  applied: "border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent)]",
  assessment: "border-[#7c3aed] bg-[#f3e8ff] text-[#7c3aed]",
  interview: "border-[var(--warning)] bg-[var(--warning-light)] text-[var(--warning)]",
  rejected: "border-[var(--danger)] bg-[var(--danger-light)] text-[var(--danger)]",
  offer: "border-[var(--success)] bg-[var(--success-light)] text-[var(--success)]",
  withdrawn: "border-border bg-muted text-muted-foreground",
};

export function StatusSelect({
  applicationId,
  current,
  className = "",
}: {
  applicationId: string;
  current: ApplicationStatus;
  className?: string;
}) {
  const t = useTranslations("Applications");
  const router = useRouter();
  const [selected, setSelected] = useState<ApplicationStatus>(current);
  const [pending, startTransition] = useTransition();

  function handleChange(next: ApplicationStatus) {
    setSelected(next);

    const fd = new FormData();
    fd.set("id", applicationId);
    fd.set("status", next);

    startTransition(async () => {
      await updateStatusAction(fd);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <select
        name="status"
        value={selected}
        onChange={(e) => handleChange(e.currentTarget.value as ApplicationStatus)}
        disabled={pending}
        aria-label={t(STATUS_LABEL_KEYS[selected])}
        className={[
          "h-9 w-40 cursor-pointer appearance-none rounded-md border px-3 pr-8 text-[13px] font-medium outline-none transition-colors",
          "hover:border-[var(--border-strong)] focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[var(--accent)]/10",
          STATUS_TONES[selected],
          className,
        ].join(" ")}
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(STATUS_LABEL_KEYS[s])}
          </option>
        ))}
      </select>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-current opacity-60"
      >
        v
      </span>
    </div>
  );
}
