import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AssessmentAnalysis, DocumentType, ParsedResume } from "@/lib/db/types";

export const DEMO_APPLICATION_LIMIT = 2;
export const DEMO_RESUME_TITLE = "Example software engineer resume";

export const DEMO_DOCUMENT_TYPES = [
  "tailored_resume",
  "cover_letter",
  "email_draft",
  "interview_prep",
] as const satisfies readonly DocumentType[];

export type DemoDocumentType = (typeof DEMO_DOCUMENT_TYPES)[number];

export type DemoUsage = {
  applications: number;
  documents: Record<DemoDocumentType, number>;
};

export function isDemoUser(
  user: Pick<User, "is_anonymous" | "user_metadata" | "app_metadata">,
): boolean {
  return (
    user.is_anonymous === true ||
    user.app_metadata?.is_demo === true ||
    user.user_metadata?.is_demo === true
  );
}

export function demoApplicationRemaining(usage: DemoUsage): number {
  return Math.max(0, DEMO_APPLICATION_LIMIT - usage.applications);
}

export function demoDocumentRemaining(
  usage: DemoUsage,
  documentType: DemoDocumentType,
): number {
  return Math.max(0, 1 - usage.documents[documentType]);
}

export async function getDemoUsage(
  supabase: SupabaseClient,
  userId: string,
): Promise<DemoUsage> {
  const [{ count, error: applicationError }, { data: events, error: eventError }] =
    await Promise.all([
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      supabase
        .from("ai_events")
        .select("document_type")
        .eq("user_id", userId)
        .eq("success", true)
        .in("event_type", ["document_generation", "document_generation_stream"])
        .in("document_type", [...DEMO_DOCUMENT_TYPES]),
    ]);

  if (applicationError || eventError) {
    throw new Error("Unable to verify demo usage.");
  }

  const documents: DemoUsage["documents"] = {
    tailored_resume: 0,
    cover_letter: 0,
    email_draft: 0,
    interview_prep: 0,
  };

  for (const event of events ?? []) {
    const type = event.document_type as DemoDocumentType | null;
    if (type && DEMO_DOCUMENT_TYPES.includes(type)) documents[type] += 1;
  }

  return { applications: count ?? 0, documents };
}

export async function assertDemoApplicationAvailable(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "is_anonymous" | "user_metadata" | "app_metadata">,
): Promise<string | null> {
  if (!isDemoUser(user)) return null;
  try {
    const usage = await getDemoUsage(supabase, user.id);
    return demoApplicationRemaining(usage) > 0
      ? null
      : "This demo allows up to 2 applications. Delete one before adding another.";
  } catch {
    return "We could not verify the demo application limit. Please try again.";
  }
}

export async function assertDemoDocumentAvailable(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "is_anonymous" | "user_metadata" | "app_metadata">,
  documentType: DocumentType,
): Promise<string | null> {
  if (!isDemoUser(user) || !DEMO_DOCUMENT_TYPES.includes(documentType as DemoDocumentType)) {
    return null;
  }
  try {
    const usage = await getDemoUsage(supabase, user.id);
    return demoDocumentRemaining(usage, documentType as DemoDocumentType) > 0
      ? null
      : "The single demo generation for this document type has already been used.";
  } catch {
    return "We could not verify the demo generation limit. Please try again.";
  }
}

export const DEMO_RESUME_PARSED: ParsedResume = {
  name: "Jordan Lee",
  contact: {
    email: "jordan.lee@example.com",
    phone: "+1 416 555 0142",
    location: "Toronto, ON",
    links: ["linkedin.com/in/jordanlee", "github.com/jordanlee"],
  },
  summary:
    "Software engineer with experience building reliable web products, data workflows, and cloud services.",
  experience: [
    {
      company: "Northstar Labs",
      title: "Software Engineering Intern",
      location: "Toronto, ON",
      start: "May 2025",
      end: "Aug 2025",
      bullets: [
        "Built reusable React and TypeScript components for a customer operations dashboard used by three internal teams.",
        "Improved API response times by 32% by profiling PostgreSQL queries and adding targeted indexes.",
        "Added automated tests and CI checks that reduced regressions during weekly releases.",
      ],
    },
    {
      company: "University Technology Centre",
      title: "Software Developer",
      location: "Toronto, ON",
      start: "Sep 2024",
      end: "Apr 2025",
      bullets: [
        "Developed Python data pipelines that validated and transformed research datasets for downstream analysis.",
        "Documented deployment and support workflows, shortening onboarding time for new team members.",
      ],
    },
  ],
  projects: [
    {
      name: "Collaborative Job Tracker",
      description: "Full-stack application for organizing job-search activity.",
      bullets: [
        "Implemented a Next.js interface, Supabase authentication, and row-level data access controls.",
        "Deployed the application with automated preview builds and production monitoring.",
      ],
    },
  ],
  education: [
    {
      degree: "Master of Engineering",
      field: "Electrical and Computer Engineering",
      school: "University of Toronto",
      start: "2024",
      end: "2026",
    },
    {
      degree: "Bachelor of Computing (Honours)",
      field: "Computer Science",
      school: "Queen's University",
      start: "2020",
      end: "2024",
    },
  ],
  skills: [
    "Languages: TypeScript, Python, Java, SQL",
    "Frontend: React, Next.js, Tailwind CSS",
    "Backend & Data: REST APIs, PostgreSQL, Supabase",
    "Cloud & Tools: Docker, GitHub Actions, Linux, Vercel",
    "Practices: Testing, CI/CD, Agile delivery, technical documentation",
  ],
};

export const DEMO_RESUME_TEXT = `Jordan Lee
Toronto, ON | +1 416 555 0142 | jordan.lee@example.com
linkedin.com/in/jordanlee | github.com/jordanlee

SUMMARY
Software engineer with experience building reliable web products, data workflows, and cloud services.

EXPERIENCE
Software Engineering Intern | Northstar Labs | Toronto, ON | May 2025 - Aug 2025
- Built reusable React and TypeScript components for a customer operations dashboard used by three internal teams.
- Improved API response times by 32% by profiling PostgreSQL queries and adding targeted indexes.
- Added automated tests and CI checks that reduced regressions during weekly releases.

Software Developer | University Technology Centre | Toronto, ON | Sep 2024 - Apr 2025
- Developed Python data pipelines that validated and transformed research datasets for downstream analysis.
- Documented deployment and support workflows, shortening onboarding time for new team members.

PROJECTS
Collaborative Job Tracker
- Implemented a Next.js interface, Supabase authentication, and row-level data access controls.
- Deployed the application with automated preview builds and production monitoring.

EDUCATION
Master of Engineering
Electrical and Computer Engineering
University of Toronto
2024 - 2026

Bachelor of Computing (Honours)
Computer Science
Queen's University
2020 - 2024

SKILLS
- Languages: TypeScript, Python, Java, SQL
- Frontend: React, Next.js, Tailwind CSS
- Backend & Data: REST APIs, PostgreSQL, Supabase
- Cloud & Tools: Docker, GitHub Actions, Linux, Vercel
- Practices: Testing, CI/CD, Agile delivery, technical documentation`;

export const DEMO_ASSESSMENT_EXAMPLE: AssessmentAnalysis = {
  summary:
    "Build and present a small full-stack feature that demonstrates clear product thinking, sound technical decisions, and concise communication.",
  deliverables: [
    "A working repository with setup instructions",
    "A short architecture and trade-off summary",
    "A five-minute walkthrough of the finished feature",
  ],
  evaluation_criteria: [
    "Correctness and completeness",
    "Code quality and maintainability",
    "Testing strategy and edge-case handling",
    "Clarity of written and verbal communication",
  ],
  preparation_steps: [
    "Confirm the required user flow and acceptance criteria",
    "Sketch the data model and component boundaries",
    "Implement the smallest complete path before adding polish",
    "Add focused tests and document important trade-offs",
  ],
  checklist: [
    "Project runs from a clean checkout",
    "README includes setup and assumptions",
    "Core path and failure states are tested",
    "Demo narrative fits within the allotted time",
  ],
  estimated_effort_hours: 4,
};
