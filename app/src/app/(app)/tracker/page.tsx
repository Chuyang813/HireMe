import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { APPLICATION_STATUS_LABEL } from "@/lib/db/types";
import { StatusSelect } from "@/components/StatusSelect";
import type { ApplicationStatus, JobApplication } from "@/lib/db/types";

export const metadata = { title: "Tracker" };

const PIPELINE_STATS: ApplicationStatus[] = ["applied", "assessment", "interview", "offer"];

function statusColor(s: ApplicationStatus): string {
  if (s === "offer") return "text-[var(--success)]";
  if (s === "rejected" || s === "withdrawn") return "opacity-50";
  return "";
}

export default async function TrackerPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Tracker");

  const { data } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const applications: JobApplication[] = (data ?? []) as JobApplication[];

  const counts = PIPELINE_STATS.reduce<Record<string, number>>((acc, s) => {
    acc[s] = applications.filter((a) => a.current_status === s).length;
    return acc;
  }, {});

  const active = applications.filter(
    (a) => !["rejected", "withdrawn"].includes(a.current_status),
  ).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="label-caps mb-2">{t("pipelineLabel")}</div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
        <Link
          href="/applications/new"
          className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
        >
          {t("newApplication")}
        </Link>
      </div>

      {applications.length > 0 && (
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-sm border border-border p-4">
            <p className="label-caps text-muted-foreground">{t("active")}</p>
            <p className="mt-1 font-display text-3xl">{active}</p>
          </div>
          {PIPELINE_STATS.map((s) => (
            <div key={s} className="rounded-sm border border-border p-4">
              <p className="label-caps text-muted-foreground">
                {APPLICATION_STATUS_LABEL[s]}
              </p>
              <p className="mt-1 font-display text-3xl">{counts[s] ?? 0}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-10">
        {applications.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-12 text-center">
            <p className="font-display text-2xl text-muted-foreground">
              {t("noAppsHeading")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("noAppsSub")}</p>
            <Link
              href="/applications/new"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              {t("addApplication")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-sm border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="label-caps px-5 py-3 text-left font-normal text-muted-foreground">
                    {t("colCompany")}
                  </th>
                  <th className="label-caps px-5 py-3 text-left font-normal text-muted-foreground">
                    {t("colPosition")}
                  </th>
                  <th className="label-caps hidden px-5 py-3 text-left font-normal text-muted-foreground sm:table-cell">
                    {t("colAdded")}
                  </th>
                  <th className="label-caps px-5 py-3 text-left font-normal text-muted-foreground">
                    {t("colStatus")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    className={`border-b border-border last:border-0 ${statusColor(app.current_status)}`}
                  >
                    <td className="px-5 py-4">
                      <Link
                        href={`/applications/${app.id}`}
                        className="font-medium hover:underline underline-offset-2"
                      >
                        {app.company_name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">
                      <Link
                        href={`/applications/${app.id}`}
                        className="hover:text-foreground"
                      >
                        {app.role_title ?? "—"}
                      </Link>
                    </td>
                    <td className="hidden px-5 py-4 text-muted-foreground sm:table-cell">
                      {new Date(app.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <StatusSelect
                        applicationId={app.id}
                        current={app.current_status}
                        className="h-8 text-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
