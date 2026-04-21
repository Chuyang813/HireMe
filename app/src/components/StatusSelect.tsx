"use client";

import { updateStatusAction } from "@/app/actions/applications";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUSES } from "@/lib/db/types";
import type { ApplicationStatus } from "@/lib/db/types";

export function StatusSelect({
  applicationId,
  current,
  className = "",
}: {
  applicationId: string;
  current: ApplicationStatus;
  className?: string;
}) {
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
            {APPLICATION_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </form>
  );
}
