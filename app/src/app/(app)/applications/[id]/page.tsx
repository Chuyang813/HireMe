export const maxDuration = 60;

import { notFound } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import type {
  ApplicationDocument,
  ApplicationTimelineEvent,
  ApplicationStatus,
  JobApplication,
  ParsedJob,
  ParsedResume,
  Profile,
  TimelineEventType,
} from "@/lib/db/types";
import { StatusSelect } from "@/components/StatusSelect";
import { WorkspaceTabs } from "./WorkspaceTabs";
import { DeleteApplicationButton } from "@/components/DeleteApplicationButton";
import { JobAnalysisCard } from "@/components/JobAnalysisCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return { title: `Application · ${id.slice(0, 8)}` };
}

// ---------------------------------------------------------------------------
// Timeline sidebar
// ---------------------------------------------------------------------------

const DOC_LABELS: Record<string, string> = {
  tailored_resume: "detailDocResume",
  cover_letter: "detailDocCoverLetter",
  email_draft: "detailDocEmailDraft",
  assessment_notes: "detailDocAssessmentNotes",
  interview_prep: "detailDocInterviewPrep",
};

const EVENT_ICON: Record<TimelineEventType, string> = {
  created: "+",
  status_changed: "→",
  document_generated: "✦",
  assessment_added: "≡",
  interview_prep_generated: "?",
  note_added: "✐",
};

type Translator = Awaited<ReturnType<typeof getTranslations>>;

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

function statusLabel(t: Translator, status: string | null): string {
  if (!status) return t("statusUnknown", { status: "unknown" });
  const key = STATUS_LABEL_KEYS[status as ApplicationStatus];
  return key ? t(key) : t("statusUnknown", { status });
}

function eventDescription(event: ApplicationTimelineEvent, t: Translator): string {
  switch (event.event_type) {
    case "created":
      return t("detailEventCreated");
    case "status_changed":
      return t("detailEventStatusChanged", { status: statusLabel(t, event.new_value) });
    case "document_generated": {
      const docKey = DOC_LABELS[event.new_value ?? ""];
      return t("detailEventDocGenerated", {
        doc: docKey ? t(docKey) : event.new_value ?? t("detailDocument"),
      });
    }
    case "assessment_added":
      return t("detailEventAssessmentAdded");
    case "interview_prep_generated":
      return t("detailEventInterviewPrepGenerated");
    case "note_added":
      return t("detailEventNoteAdded");
    default:
      return event.event_type;
  }
}

function formatTimestamp(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function TimelineSidebar({ events, locale, t }: { events: ApplicationTimelineEvent[]; locale: string; t: Translator }) {
  return (
    <aside>
      <div className="sticky top-6">
        <p className="label-caps mb-4">{t("detailActivity")}</p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("detailNoActivity")}</p>
        ) : (
          <ol className="space-y-0">
            {events.map((event, i) => (
              <li key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-[10px] text-muted-foreground">
                    {EVENT_ICON[event.event_type] ?? "·"}
                  </span>
                  {i < events.length - 1 && (
                    <div className="w-px flex-1 bg-border" />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p className="text-xs leading-tight">
                    {eventDescription(event, t)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTimestamp(event.created_at, locale)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Applications");
  const locale = await getLocale();

  const [
    { data: app },
    { data: docs },
    { data: resume },
    { data: timeline },
    { data: profile },
  ] = await Promise.all([
    supabase
      .from("job_applications")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("application_documents")
      .select("*")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("base_resumes")
      .select("id, parsed_resume_json")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single(),
    supabase
      .from("application_timeline_events")
      .select("*")
      .eq("application_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("profiles")
      .select("full_name, display_name")
      .eq("id", user.id)
      .single(),
  ]);

  if (!app) notFound();

  const application = app as JobApplication;
  const documents = (docs ?? []) as ApplicationDocument[];
  const events = (timeline ?? []) as ApplicationTimelineEvent[];
  const job = application.parsed_job_json as ParsedJob | null;
  const parsedResume = (resume?.parsed_resume_json as ParsedResume | null) ?? null;
  const profileData = profile as Pick<Profile, "full_name" | "display_name"> | null;

  const fullName = profileData?.full_name ?? profileData?.display_name ?? "";
  const userFirstName = fullName.split(" ")[0] || undefined;

  const docMap = new Map<string, ApplicationDocument>();
  for (const doc of documents) {
    if (!docMap.has(doc.document_type)) docMap.set(doc.document_type, doc);
  }

  // Show reminder banner if status is "saved" and created > 1 day ago
  const oneDayMs = 24 * 60 * 60 * 1000;
  const staleCutoff = new Date();
  staleCutoff.setTime(staleCutoff.getTime() - oneDayMs);
  const isStaleSaved =
    application.current_status === "saved" &&
    new Date(application.created_at) < staleCutoff;

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-12 xl:px-10">
      <div className="label-caps mb-2">
        <Link href="/applications" className="hover:underline">
          {t("heading")}
        </Link>{" "}
        / {application.company_name ?? t("heading")}
      </div>

      {isStaleSaved && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-[var(--warning)] bg-[var(--warning-light)] px-4 py-3">
          <span className="mt-0.5 shrink-0 text-[var(--warning)]">⚠</span>
          <p className="text-sm text-amber-900">
            <strong>{t("detailStaleReminder")}</strong> {t("detailStaleBody")}{" "}
            <span className="opacity-75">
              {t("detailStaleHint")}
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight">
            {application.role_title ?? t("detailUntitledRole")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {application.company_name ?? t("detailUnknownCompany")}
            {application.location ? ` · ${application.location}` : ""}
            {application.job_url ? (
              <>
                {" · "}
                <a
                  href={application.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2 opacity-60 hover:opacity-100"
                >
                  {t("detailJobPosting")}
                </a>
              </>
            ) : null}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusSelect
            applicationId={application.id}
            current={application.current_status}
          />
          <DeleteApplicationButton applicationId={application.id} variant="text" />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_220px] xl:grid-cols-[minmax(0,1fr)_240px] xl:gap-10">
        <main className="min-w-0">
          {job && (
            <JobAnalysisCard
              job={job}
              resume={parsedResume}
            />
          )}

          <div className={job ? "mt-8" : undefined}>
            <WorkspaceTabs
              applicationId={application.id}
              hasResume={!!resume}
              documents={{
                tailored_resume: docMap.get("tailored_resume") ?? null,
                cover_letter: docMap.get("cover_letter") ?? null,
                email_draft: docMap.get("email_draft") ?? null,
                interview_prep: docMap.get("interview_prep") ?? null,
              }}
              roleTitle={application.role_title ?? undefined}
              userFirstName={userFirstName}
              companyName={application.company_name ?? undefined}
              statusLabel={statusLabel(t, application.current_status)}
            />
          </div>
        </main>
        <TimelineSidebar events={events} locale={locale} t={t} />
      </div>
    </div>
  );
}
