import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import type { ApplicationStatus, ApplicationTimelineEvent, JobApplication, Profile } from "@/lib/db/types";

export const metadata = { title: "Dashboard" };

const INACTIVE_STATUSES: ApplicationStatus[] = ["rejected", "offer", "withdrawn"];

const EVENT_TYPE_LABEL_KEY: Record<string, string> = {
  created: "eventCreated",
  status_changed: "eventStatusChanged",
  document_generated: "eventDocumentGenerated",
  assessment_added: "eventAssessmentAdded",
  interview_prep_generated: "eventInterviewPrepGenerated",
  note_added: "eventNoteAdded",
};

const STATUS_LABEL_KEY: Record<ApplicationStatus, string> = {
  saved: "statusSaved",
  ready_to_apply: "statusReadyToApply",
  applied: "statusApplied",
  assessment: "statusAssessment",
  interview: "statusInterview",
  rejected: "statusRejected",
  offer: "statusOffer",
  withdrawn: "statusWithdrawn",
};

type TimelineEventWithApp = ApplicationTimelineEvent & {
  job_applications: { role_title: string | null; company_name: string | null } | null;
};

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  if (!(profile as Profile | null)?.onboarding_complete) {
    redirect("/onboarding");
  }

  const [{ data: allAppsData }, { data: recentData }, { data: eventsData }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, current_status")
      .eq("user_id", user.id),
    supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("application_timeline_events")
      .select("*, job_applications(role_title, company_name)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const allApps = (allAppsData ?? []) as Pick<JobApplication, "id" | "current_status">[];
  const applications: JobApplication[] = (recentData ?? []) as JobApplication[];
  const events = (eventsData ?? []) as TimelineEventWithApp[];

  const activeCount = allApps.filter(
    (a) => !INACTIVE_STATUSES.includes(a.current_status),
  ).length;

  const statusCount = (status: ApplicationStatus) =>
    allApps.filter((a) => a.current_status === status).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="label-caps mb-2">{t("overviewLabel")}</div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
        <span className="label-caps hidden sm:inline">{user.email}</span>
      </div>

      {/* Stats row */}
      <div className="mt-8">
        <div className="label-caps mb-3">{t("statsLabel")}</div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(
            [
              { key: "active", value: activeCount },
              { key: "applied", status: "applied" as ApplicationStatus },
              { key: "assessment", status: "assessment" as ApplicationStatus },
              { key: "interview", status: "interview" as ApplicationStatus },
              { key: "offer", status: "offer" as ApplicationStatus },
            ] as Array<{ key: string; value?: number; status?: ApplicationStatus }>
          ).map(({ key, value, status }) => (
            <div
              key={key}
              className="rounded-sm border border-border bg-background p-4 text-center"
            >
              <p className="font-display text-3xl">
                {value !== undefined ? value : statusCount(status!)}
              </p>
              <p className="label-caps mt-1 text-muted-foreground">{t(key as Parameters<typeof t>[0])}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <div className="mt-10">
        <div className="label-caps mb-3">{t("recentActivityLabel")}</div>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noActivity")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((ev) => {
              const appName =
                ev.job_applications?.role_title ??
                ev.job_applications?.company_name ??
                t("unknownApplication");
              const eventLabelKey = EVENT_TYPE_LABEL_KEY[ev.event_type];
              return (
                <li
                  key={ev.id}
                  className="flex items-baseline justify-between gap-4 rounded-sm border border-border px-4 py-3"
                >
                  <span className="text-sm">
                    <span className="text-muted-foreground">
                      {eventLabelKey ? t(eventLabelKey as Parameters<typeof t>[0]) : ev.event_type}
                    </span>
                    {" · "}
                    <span className="font-medium">{appName}</span>
                    {ev.new_value ? (
                      <span className="ml-1 text-muted-foreground">({ev.new_value})</span>
                    ) : null}
                  </span>
                  <span className="label-caps shrink-0 text-muted-foreground">
                    {new Date(ev.created_at).toLocaleDateString()}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Recent applications */}
      <div className="mt-10">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="label-caps">
            {t("recentApplications", { count: applications.length })}
          </h2>
          <Link
            href="/applications/new"
            className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t("addApplication")}
          </Link>
        </div>

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
          <ul className="flex flex-col gap-3">
            {applications.map((app) => (
              <li key={app.id} className="rounded-sm border border-border bg-background p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl">
                      {app.role_title ?? t("untitledRole")}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {app.company_name ?? t("unknownCompany")}
                      {app.location ? ` · ${app.location}` : ""}
                    </p>
                  </div>
                  <span className="label-caps whitespace-nowrap rounded-sm border border-border px-1.5 py-0.5">
                    {t(STATUS_LABEL_KEY[app.current_status] as Parameters<typeof t>[0])}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("updatedPrefix")} {new Date(app.updated_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
