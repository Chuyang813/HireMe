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
  saved: "border-slate-200 bg-slate-50 text-slate-700",
  ready_to_apply: "border-blue-200 bg-blue-50 text-blue-700",
  applied: "border-indigo-200 bg-indigo-50 text-indigo-700",
  assessment: "border-amber-200 bg-amber-50 text-amber-800",
  interview: "border-violet-200 bg-violet-50 text-violet-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
  offer: "border-green-200 bg-green-50 text-green-700",
  withdrawn: "border-zinc-200 bg-zinc-50 text-zinc-600",
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
          "h-9 min-w-32 cursor-pointer appearance-none rounded-md border px-3 pr-8 text-sm font-medium shadow-sm outline-none transition-colors",
          "hover:border-foreground/30 focus:border-foreground focus:ring-2 focus:ring-foreground/10",
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
