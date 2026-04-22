import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import type {
  ApplicationDocument,
  ApplicationTimelineEvent,
  ApplicationStatus,
  JobApplication,
  ParsedJob,
  Profile,
  TimelineEventType,
} from "@/lib/db/types";
import { APPLICATION_STATUS_LABEL } from "@/lib/db/types";
import { StatusSelect } from "@/components/StatusSelect";
import { WorkspaceTabs } from "./WorkspaceTabs";

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
  tailored_resume: "Resume",
  cover_letter: "Cover letter",
  email_draft: "Email draft",
  assessment_notes: "Assessment notes",
  interview_prep: "Interview prep",
};

const EVENT_ICON: Record<TimelineEventType, string> = {
  created: "+",
  status_changed: "→",
  document_generated: "✦",
  assessment_added: "≡",
  interview_prep_generated: "?",
  note_added: "✐",
};

function eventDescription(event: ApplicationTimelineEvent): string {
  switch (event.event_type) {
    case "created":
      return "Application created";
    case "status_changed":
      return `Status → ${
        APPLICATION_STATUS_LABEL[event.new_value as ApplicationStatus] ??
        event.new_value ??
        "unknown"
      }`;
    case "document_generated":
      return `${DOC_LABELS[event.new_value ?? ""] ?? event.new_value ?? "Document"} generated`;
    case "assessment_added":
      return "Assessment uploaded";
    case "interview_prep_generated":
      return "Interview prep generated";
    case "note_added":
      return "Notes saved";
    default:
      return event.event_type;
  }
}

function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function TimelineSidebar({ events }: { events: ApplicationTimelineEvent[] }) {
  return (
    <aside>
      <div className="sticky top-6">
        <p className="label-caps mb-4">Activity</p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity yet.</p>
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
                    {eventDescription(event)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTimestamp(event.created_at)}
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
      .select("id")
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
  const profileData = profile as Pick<Profile, "full_name" | "display_name"> | null;

  const fullName = profileData?.full_name ?? profileData?.display_name ?? "";
  const userFirstName = fullName.split(" ")[0] || undefined;

  const docMap = new Map<string, ApplicationDocument>();
  for (const doc of documents) {
    if (!docMap.has(doc.document_type)) docMap.set(doc.document_type, doc);
  }

  // Show reminder banner if status is "saved" and created > 1 day ago
  const oneDayMs = 24 * 60 * 60 * 1000;
  const isStaleSaved =
    application.current_status === "saved" &&
    Date.now() - new Date(application.created_at).getTime() > oneDayMs;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-12">
      <div className="label-caps mb-2">
        <Link href="/applications" className="hover:underline">
          Applications
        </Link>{" "}
        / {application.company_name ?? "Application"}
      </div>

      {isStaleSaved && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-yellow-500">⚠</span>
          <p className="text-sm text-yellow-800">
            <strong>Reminder:</strong> You haven&apos;t updated the status of this application. Did you apply?{" "}
            <span className="text-yellow-700 opacity-75">
              Update the status above once you&apos;ve submitted your application.
            </span>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl leading-tight">
            {application.role_title ?? "Untitled role"}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {application.company_name ?? "Unknown company"}
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
                  Job posting ↗
                </a>
              </>
            ) : null}
          </p>
        </div>

        <StatusSelect
          applicationId={application.id}
          current={application.current_status}
        />
      </div>

      {job && (
        <div className="mt-8 rounded-md border border-border bg-muted/40 p-5 shadow-sm">
          <h2 className="label-caps mb-3">Job analysis</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {job.role_summary ? (
              <div className="sm:col-span-2">
                <p className="label-caps mb-1.5 text-muted-foreground">Summary</p>
                <p className="text-sm leading-relaxed">{job.role_summary}</p>
              </div>
            ) : null}
            {job.required_skills?.length ? (
              <div>
                <p className="label-caps mb-1.5 text-muted-foreground">
                  Required skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.required_skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border px-1.5 py-0.5 text-xs bg-white shadow-sm"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {job.desired_skills?.length ? (
              <div>
                <p className="label-caps mb-1.5 text-muted-foreground">
                  Desired skills
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {job.desired_skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {job.responsibilities?.length ? (
              <div className="sm:col-span-2">
                <p className="label-caps mb-1.5 text-muted-foreground">
                  Key responsibilities
                </p>
                <ul className="list-disc pl-4 text-sm leading-relaxed text-muted-foreground space-y-0.5">
                  {job.responsibilities.slice(0, 6).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <div className="mt-10 grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_240px]">
        <WorkspaceTabs
          applicationId={application.id}
          hasResume={!!resume}
          documents={{
            tailored_resume: docMap.get("tailored_resume") ?? null,
            cover_letter: docMap.get("cover_letter") ?? null,
            email_draft: docMap.get("email_draft") ?? null,
          }}
          userFirstName={userFirstName}
          companyName={application.company_name ?? undefined}
        />
        <TimelineSidebar events={events} />
      </div>
    </div>
  );
}
