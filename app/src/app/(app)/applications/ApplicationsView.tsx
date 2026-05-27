"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { JobApplication, ApplicationStatus } from "@/lib/db/types";
import { StatusSelect } from "@/components/StatusSelect";
import { DeleteApplicationButton } from "@/components/DeleteApplicationButton";
import { Button } from "@/components/ui/Button";

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

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isStale(app: JobApplication): boolean {
  return (
    app.current_status === "saved" &&
    Date.now() - new Date(app.created_at).getTime() > ONE_DAY_MS
  );
}

const PIPELINE_STATS: ApplicationStatus[] = [
  "applied",
  "assessment",
  "interview",
  "offer",
];

function statusRowColor(s: ApplicationStatus): string {
  if (s === "offer") return "text-success";
  if (s === "rejected" || s === "withdrawn") return "opacity-50";
  return "";
}

type View = "cards" | "table";

export function ApplicationsView({
  applications,
  hasResume,
}: {
  applications: JobApplication[];
  hasResume: boolean;
}) {
  const t = useTranslations("Applications");
  const [view, setView] = useState<View>(() => {
    if (typeof window === "undefined") return "cards";
    const stored = localStorage.getItem("applications-view");
    return stored === "cards" || stored === "table" ? stored : "cards";
  });

  function switchView(v: View) {
    setView(v);
    localStorage.setItem("applications-view", v);
  }

  const counts = PIPELINE_STATS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = applications.filter((a) => a.current_status === s).length;
    return acc;
  }, {});

  const active = applications.filter(
    (a) => !["rejected", "withdrawn"].includes(a.current_status),
  ).length;

  return (
    <>
      {!hasResume && (
        <div className="mt-6 flex items-center gap-3 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0 text-accent"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {t("noResumeBanner")}{" "}
            <Link
              href="/resumes"
              className="font-medium text-accent underline underline-offset-2 hover:opacity-80"
            >
              {t("uploadNow")}
            </Link>
          </span>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <span className="label-caps text-muted-foreground">
          {t("viewToggleLabel")}
        </span>
        <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
          <button
            type="button"
            onClick={() => switchView("cards")}
            aria-label={t("viewCards")}
            title={t("viewCards")}
            className={[
              "flex h-7 w-7 items-center justify-center rounded transition",
              view === "cards"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <GridIcon />
          </button>
          <button
            type="button"
            onClick={() => switchView("table")}
            aria-label={t("viewTable")}
            title={t("viewTable")}
            className={[
              "flex h-7 w-7 items-center justify-center rounded transition",
              view === "table"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <ListIcon />
          </button>
        </div>
      </div>

      <div className="mt-4">
        {applications.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-6 text-center sm:p-12">
            <p className="font-display text-lg text-muted-foreground sm:text-2xl">
              {t("noAppsHeading")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("noAppsSub")}
            </p>
            <Button variant="primary" className="mt-6">
              <Link href="/applications/new">{t("addApplication")}</Link>
            </Button>
          </div>
        ) : view === "cards" ? (
          <ul className="flex flex-col gap-3">
            {applications.map((app) => (
              <li key={app.id} className="relative">
                <Link
                  href={`/applications/${app.id}`}
                  className="block rounded-md border border-border bg-white p-3 transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--muted)] sm:p-5"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <h3 className="font-display text-base sm:text-xl">
                        {app.role_title ?? t("untitledRole")}
                      </h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {app.company_name ?? t("unknownCompany")}
                        {app.location ? ` · ${app.location}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isStale(app) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]"
                          title={t("staleTooltip")}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
                          {t("staleUpdateStatus")}
                        </span>
                      )}
                      <span className={`badge badge-${app.current_status}`}>
                        {t(
                          STATUS_LABEL_KEYS[
                            app.current_status
                          ] as Parameters<typeof t>[0],
                        )}
                      </span>
                      <DeleteApplicationButton
                        applicationId={app.id}
                        variant="icon"
                      />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("updatedPrefix")}{" "}
                    {new Date(app.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-md border border-border bg-white p-3 sm:p-4">
                <p className="label-caps text-muted-foreground">
                  {t("active")}
                </p>
                <p className="mt-1 font-display text-2xl sm:text-3xl">{active}</p>
              </div>
              {PIPELINE_STATS.map((s) => (
                <div
                  key={s}
                  className="rounded-md border border-border bg-white p-3 sm:p-4"
                >
                  <p className="label-caps text-muted-foreground">
                    {t(STATUS_LABEL_KEYS[s] as Parameters<typeof t>[0])}
                  </p>
                  <p className="mt-1 font-display text-2xl sm:text-3xl">
                    {counts[s] ?? 0}
                  </p>
                </div>
              ))}
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="label-caps px-3 py-2 text-left font-normal text-muted-foreground sm:px-5 sm:py-3">
                      {t("colCompany")}
                    </th>
                    <th className="label-caps px-3 py-2 text-left font-normal text-muted-foreground sm:px-5 sm:py-3">
                      {t("colPosition")}
                    </th>
                    <th className="label-caps hidden px-3 py-2 text-left font-normal text-muted-foreground sm:table-cell sm:px-5 sm:py-3">
                      {t("colAdded")}
                    </th>
                    <th className="label-caps px-3 py-2 text-left font-normal text-muted-foreground sm:px-5 sm:py-3">
                      {t("colStatus")}
                    </th>
                    <th className="label-caps px-3 py-2 text-left font-normal text-muted-foreground sm:px-5 sm:py-3">
                      {t("colActions")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr
                      key={app.id}
                      className={`border-b border-border last:border-0 bg-white ${statusRowColor(app.current_status)}`}
                    >
                      <td className="max-w-[200px] px-3 py-2.5 sm:px-5 sm:py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/applications/${app.id}`}
                            className="min-w-0 truncate font-medium hover:underline underline-offset-2"
                          >
                            {app.company_name ?? "—"}
                          </Link>
                          {isStale(app) && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[var(--warning-light)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)]"
                              title={t("staleTooltip")}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-[var(--warning)]" />
                              {t("staleUpdateStatus")}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground sm:px-5 sm:py-4">
                        <Link
                          href={`/applications/${app.id}`}
                          className="hover:text-foreground"
                        >
                          {app.role_title ?? "—"}
                        </Link>
                      </td>
                      <td className="hidden px-3 py-2.5 text-muted-foreground sm:table-cell sm:px-5 sm:py-4">
                        {new Date(app.created_at).toLocaleDateString()}
                      </td>
                      <td className="w-44 whitespace-nowrap px-3 py-2.5 sm:px-5 sm:py-4">
                        <StatusSelect
                          applicationId={app.id}
                          current={app.current_status}
                          className="h-8 w-40 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2.5 sm:px-5 sm:py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/applications/${app.id}`}
                            className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-medium hover:bg-[var(--bg-hover)]"
                          >
                            →
                          </Link>
                          <DeleteApplicationButton
                            applicationId={app.id}
                            variant="icon"
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function GridIcon() {
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
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
    </svg>
  );
}

function ListIcon() {
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
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
