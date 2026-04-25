"use client";

import { useTranslations } from "next-intl";
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

  return (
    <form action={updateStatusAction}>
      <input type="hidden" name="id" value={applicationId} />
      <select
        name="status"
        defaultValue={current}
        onChange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
        className={`cursor-pointer rounded-sm border border-border bg-background px-2 text-sm outline-none focus:border-foreground ${className}`}
      >
        {APPLICATION_STATUSES.map((s) => (
          <option key={s} value={s}>
            {t(STATUS_LABEL_KEYS[s])}
          </option>
        ))}
      </select>
    </form>
  );
}
