import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";
import type {
  ApplicationStatus,
  ApplicationTimelineEvent,
  JobApplication,
  Profile,
} from "@/lib/db/types";

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

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function fullNameFromProfile(profile: Pick<Profile, "full_name" | "display_name"> | null) {
  return profile?.full_name || profile?.display_name || "there";
}

function statusCount(apps: Pick<JobApplication, "current_status">[], status: ApplicationStatus) {
  return apps.filter((a) => a.current_status === status).length;
}

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="font-display text-2xl leading-none sm:text-4xl">{value}</p>
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
      <p className="label-caps mt-2 text-foreground sm:mt-4">{label}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function EventBadge({
  status,
  label,
}: {
  status: ApplicationStatus | null;
  label: string;
}) {
  const statusClass = status ? `badge-${status}` : "badge-saved";
  return (
    <span className={`badge ${statusClass}`}>{label}</span>
  );
}

function eventStatus(event: TimelineEventWithApp): ApplicationStatus | null {
  if (event.event_type !== "status_changed") return null;
  const value = event.new_value as ApplicationStatus | null;
  return value && value in STATUS_LABEL_KEY ? value : null;
}

function activityTitle(event: TimelineEventWithApp, t: Translator) {
  return (
    event.job_applications?.role_title ??
    event.job_applications?.company_name ??
    t("unknownApplication")
  );
}

function activitySubtitle(event: TimelineEventWithApp, t: Translator) {
  const eventLabelKey = EVENT_TYPE_LABEL_KEY[event.event_type];
  const label = eventLabelKey ? t(eventLabelKey as Parameters<typeof t>[0]) : event.event_type;
  const status = eventStatus(event);
  if (!status) return label;
  return `${label} · ${t(STATUS_LABEL_KEY[status] as Parameters<typeof t>[0])}`;
}

function SmallIcon({ kind }: { kind: "trend" | "send" | "doc" | "calendar" | "gear" | "briefcase" }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (kind === "trend") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 17l6-6 4 4 6-8" />
        <path d="M15 7h5v5" />
      </svg>
    );
  }
  if (kind === "send") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M22 2L11 13" />
        <path d="M22 2l-7 20-4-9-9-4 20-7z" />
      </svg>
    );
  }
  if (kind === "doc") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M8 3h6l4 4v14H8z" />
        <path d="M14 3v5h5" />
        <path d="M10 13h6" />
        <path d="M10 17h4" />
      </svg>
    );
  }
  if (kind === "calendar" || kind === "briefcase") {
    return (
      <svg {...common} aria-hidden="true">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3v4" />
        <path d="M16 3v4" />
        <path d="M4 10h16" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
      <path d="M12 2v3" />
      <path d="M12 19v3" />
      <path d="M2 12h3" />
      <path d="M19 12h3" />
    </svg>
  );
}

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Dashboard");

  const [{ data: profile }, { data: defaultResume }] = await Promise.all([
    supabase
    .from("profiles")
    .select("onboarding_complete, full_name, display_name")
    .eq("id", user.id)
      .single(),
    supabase
      .from("base_resumes")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .limit(1)
      .maybeSingle(),
  ]);

  if (!defaultResume) {
    redirect("/onboarding");
  }

  const [{ data: allAppsData }, { data: recentData }, { data: eventsData }, { count: docEventCount }] = await Promise.all([
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
    supabase
      .from("application_timeline_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", "document_generated"),
  ]);

  const allApps = (allAppsData ?? []) as Pick<JobApplication, "id" | "current_status">[];
  const applications: JobApplication[] = (recentData ?? []) as JobApplication[];
  const events = (eventsData ?? []) as TimelineEventWithApp[];
  const profileData = profile as Pick<Profile, "full_name" | "display_name"> | null;
  const hasApplications = allApps.length > 0;
  const hasGeneratedDocument = (docEventCount ?? 0) > 0;
  const firstApplicationId = allApps[0]?.id ?? null;

  const activeCount = allApps.filter(
    (a) => !INACTIVE_STATUSES.includes(a.current_status),
  ).length;
  const interviewCount = statusCount(allApps, "interview");
  const nextActionApp =
    applications.find((app) => app.current_status === "interview") ??
    applications.find((app) => app.current_status === "assessment") ??
    applications[0] ??
    null;

  const stats = [
    {
      label: t("active"),
      value: activeCount,
      sub: t("activeSub"),
      icon: <SmallIcon kind="trend" />,
    },
    {
      label: t("applied"),
      value: statusCount(allApps, "applied"),
      sub: t("appliedSub"),
      icon: <SmallIcon kind="send" />,
    },
    {
      label: t("assessment"),
      value: statusCount(allApps, "assessment"),
      sub: t("assessmentSub"),
      icon: <SmallIcon kind="doc" />,
    },
    {
      label: t("interview"),
      value: interviewCount,
      sub: t("interviewSub"),
      icon: <SmallIcon kind="calendar" />,
    },
    {
      label: t("offer"),
      value: statusCount(allApps, "offer"),
      sub: t("offerSub"),
      icon: <SmallIcon kind="gear" />,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-14">
      {(!hasApplications || !hasGeneratedDocument) && (
        <div className="mb-8 sm:mb-10">
          <OnboardingChecklist
            hasApplication={hasApplications}
            hasGeneratedDocument={hasGeneratedDocument}
            firstApplicationId={firstApplicationId}
          />
        </div>
      )}

      <section className="flex items-start justify-between gap-8">
        <div>
          <p className="label-caps mb-6">{t("overviewLabel")}</p>
          <h1 className="font-display text-2xl leading-none sm:text-5xl md:text-6xl">
            {t("heading")}
          </h1>
          <div className="mt-3 space-y-1 text-sm text-muted-foreground sm:mt-6 sm:text-lg">
            <p>{t("welcomeBack", { name: fullNameFromProfile(profileData).split(" ")[0] })}</p>
            <p className="text-xs sm:text-base">
              {hasApplications
                ? t("summary", {
                    active: activeCount,
                    interviews: interviewCount,
                  })
                : t("emptySummary")}
            </p>
          </div>
        </div>

        <Link
          href="/applications/new"
          className="mt-10 hidden items-center gap-2 rounded-md bg-accent px-4 py-2 text-[13px] font-medium text-accent-foreground hover:bg-[var(--accent-hover)] sm:inline-flex"
        >
          <span className="text-lg leading-none">+</span>
          {t("newApplication")}
        </Link>
      </section>

      <section className="mt-8 sm:mt-14">
        <p className="label-caps mb-4">{t("statsLabel")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-5">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
      </section>

      <section className="mt-8 grid grid-cols-1 gap-4 sm:mt-14 sm:gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="label-caps mb-4">{t("nextActionLabel")}</p>
          <div className="flex min-h-72 flex-col justify-between rounded-md border border-border bg-background p-4 sm:p-6">
            <div className="flex items-start gap-6">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SmallIcon kind="briefcase" />
              </span>
              <div>
                <h2 className="font-display text-base leading-snug sm:text-xl">
                  {nextActionApp
                    ? t("nextActionTitle", {
                        role: nextActionApp.role_title ?? t("untitledRole"),
                      })
                    : t("firstApplicationTitle")}
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  {nextActionApp ? t("nextActionBody") : t("firstApplicationBody")}
                </p>
              </div>
            </div>
            <div className="mt-10 flex justify-end">
              <Link
                href={nextActionApp ? `/applications/${nextActionApp.id}` : "/applications/new"}
                className="inline-flex h-9 min-w-36 items-center justify-center gap-2 rounded-md border border-border px-4 text-[13px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
              >
                {nextActionApp ? t("prepareNow") : t("addApplication")}
                <span aria-hidden="true">-&gt;</span>
              </Link>
            </div>
          </div>
        </div>

        <div>
          <div className="mb-4 flex items-center justify-between gap-4">
            <p className="label-caps">{t("recentActivityLabel")}</p>
            <Link href="/applications" className="text-sm text-muted-foreground hover:text-foreground">
              {t("viewAll")}
            </Link>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-3 sm:px-5">
            {events.length === 0 ? (
              <p className="py-8 text-sm text-muted-foreground">{t("noActivity")}</p>
            ) : (
              <ul>
                {events.map((ev) => {
                  const status = eventStatus(ev);
                  return (
                    <li
                      key={ev.id}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-5 border-b border-border py-3 last:border-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-base leading-tight">
                          {activityTitle(ev, t)}
                        </p>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {activitySubtitle(ev, t)}
                        </p>
                      </div>
                      <p className="hidden text-xs text-muted-foreground sm:block">
                        {new Date(ev.created_at).toLocaleDateString()}
                      </p>
                      <EventBadge
                        status={status}
                        label={
                          status
                            ? t(STATUS_LABEL_KEY[status] as Parameters<typeof t>[0])
                            : t(EVENT_TYPE_LABEL_KEY[ev.event_type] as Parameters<typeof t>[0])
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
