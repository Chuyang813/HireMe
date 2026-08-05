import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { AssessmentAnalysis, DocumentType, ParsedResume } from "@/lib/db/types";

export const DEMO_APPLICATION_LIMIT = 2;
export const DEMO_RESUME_TITLE = "Example product operations resume";

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
  applicationId?: string,
): Promise<DemoUsage> {
  let eventQuery = supabase
    .from("ai_events")
    .select("document_type")
    .eq("user_id", userId)
    .eq("success", true)
    .in("event_type", ["document_generation", "document_generation_stream"])
    .in("document_type", [...DEMO_DOCUMENT_TYPES]);
  if (applicationId) eventQuery = eventQuery.eq("application_id", applicationId);

  const [{ count, error: applicationError }, { data: events, error: eventError }] =
    await Promise.all([
      supabase
        .from("job_applications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
      eventQuery,
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
  applicationId: string,
): Promise<string | null> {
  if (!isDemoUser(user) || !DEMO_DOCUMENT_TYPES.includes(documentType as DemoDocumentType)) {
    return null;
  }
  try {
    const usage = await getDemoUsage(supabase, user.id, applicationId);
    return demoDocumentRemaining(usage, documentType as DemoDocumentType) > 0
      ? null
      : "The single demo generation for this document type has already been used for this application.";
  } catch {
    return "We could not verify the demo generation limit. Please try again.";
  }
}

export const DEMO_RESUME_PARSED: ParsedResume = {
  name: "Maya Patel",
  contact: {
    email: "maya.patel@example.com",
    phone: "+1 604 555 0186",
    location: "Vancouver, BC",
    links: ["linkedin.com/in/mayapatel-example"],
  },
  summary:
    "Product operations analyst experienced in customer research, reporting, and cross-functional process improvement.",
  experience: [
    {
      company: "Meridian Market Co.",
      title: "Operations Analyst",
      location: "Vancouver, BC",
      start: "Mar 2023",
      end: "Present",
      bullets: [
        "Built weekly Excel and Tableau reports that gave sales and service leaders a shared view of customer trends.",
        "Mapped order-support workflows and coordinated changes that reduced average resolution time by 18%.",
        "Synthesized survey responses and interview notes into quarterly recommendations for product and marketing teams.",
      ],
    },
    {
      company: "CivicWorks Foundation",
      title: "Program Coordinator",
      location: "Burnaby, BC",
      start: "Jun 2021",
      end: "Feb 2023",
      bullets: [
        "Coordinated schedules, budgets, and communications for six community programs serving more than 400 participants.",
        "Created standardized intake forms and status trackers that improved handoffs between staff and volunteers.",
      ],
    },
  ],
  projects: [
    {
      name: "Customer Feedback Taxonomy",
      description: "Independent research and reporting project for a local retailer.",
      bullets: [
        "Coded 600 customer comments into a reusable taxonomy covering delivery, pricing, and service themes.",
        "Presented a prioritized action plan and dashboard mock-up to the store leadership team.",
      ],
    },
  ],
  education: [
    {
      degree: "Bachelor of Business Administration",
      field: "Operations Management",
      school: "Simon Fraser University",
      start: "2017",
      end: "2021",
    },
    {
      degree: "Certificate",
      field: "User Experience Research",
      school: "British Columbia Institute of Technology",
      start: "2022",
      end: "2022",
    },
  ],
  skills: [
    "Analytics: Excel, Tableau, SQL basics, survey analysis",
    "Operations: Process mapping, KPI reporting, workflow documentation",
    "Research: Customer interviews, thematic analysis, questionnaire design",
    "Tools: Airtable, Notion, Google Workspace, Microsoft PowerPoint",
    "Collaboration: Stakeholder facilitation, project coordination, executive summaries",
  ],
};

export const DEMO_RESUME_TEXT = `Maya Patel
Vancouver, BC | +1 604 555 0186 | maya.patel@example.com
linkedin.com/in/mayapatel-example

SUMMARY
Product operations analyst experienced in customer research, reporting, and cross-functional process improvement.

EXPERIENCE
Operations Analyst | Meridian Market Co. | Vancouver, BC | Mar 2023 - Present
- Built weekly Excel and Tableau reports that gave sales and service leaders a shared view of customer trends.
- Mapped order-support workflows and coordinated changes that reduced average resolution time by 18%.
- Synthesized survey responses and interview notes into quarterly recommendations for product and marketing teams.

Program Coordinator | CivicWorks Foundation | Burnaby, BC | Jun 2021 - Feb 2023
- Coordinated schedules, budgets, and communications for six community programs serving more than 400 participants.
- Created standardized intake forms and status trackers that improved handoffs between staff and volunteers.

PROJECTS
Customer Feedback Taxonomy
- Coded 600 customer comments into a reusable taxonomy covering delivery, pricing, and service themes.
- Presented a prioritized action plan and dashboard mock-up to the store leadership team.

EDUCATION
Bachelor of Business Administration
Operations Management
Simon Fraser University
2017 - 2021

Certificate
User Experience Research
British Columbia Institute of Technology
2022

SKILLS
- Analytics: Excel, Tableau, SQL basics, survey analysis
- Operations: Process mapping, KPI reporting, workflow documentation
- Research: Customer interviews, thematic analysis, questionnaire design
- Tools: Airtable, Notion, Google Workspace, Microsoft PowerPoint
- Collaboration: Stakeholder facilitation, project coordination, executive summaries`;

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
