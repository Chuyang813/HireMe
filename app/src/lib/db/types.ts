// HireMe — hand-written DB types mirroring supabase/migrations.
// Keep in sync with 0001_init.sql. Fields match column names exactly.

export type ApplicationStatus =
  | "saved"
  | "ready_to_apply"
  | "applied"
  | "assessment"
  | "interview"
  | "rejected"
  | "offer"
  | "withdrawn";

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  "saved",
  "ready_to_apply",
  "applied",
  "assessment",
  "interview",
  "rejected",
  "offer",
  "withdrawn",
];

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  saved: "Saved",
  ready_to_apply: "Ready to apply",
  applied: "Applied",
  assessment: "Assessment",
  interview: "Interview",
  rejected: "Rejected",
  offer: "Offer",
  withdrawn: "Withdrawn",
};

export type DocumentType =
  | "tailored_resume"
  | "cover_letter"
  | "email_draft"
  | "assessment_notes"
  | "interview_prep";

export type TimelineEventType =
  | "created"
  | "status_changed"
  | "document_generated"
  | "assessment_added"
  | "interview_prep_generated"
  | "note_added";

export interface ParsedResume {
  name?: string;
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    links?: string[];
  };
  summary?: string;
  education?: Array<{
    school?: string;
    degree?: string;
    field?: string;
    start?: string;
    end?: string;
    notes?: string;
  }>;
  experience?: Array<{
    company?: string;
    title?: string;
    location?: string;
    start?: string;
    end?: string;
    bullets?: string[];
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    bullets?: string[];
    links?: string[];
  }>;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
}

export interface ParsedJob {
  company_name?: string;
  role_title?: string;
  location?: string;
  employment_type?: string;
  role_summary?: string;
  responsibilities?: string[];
  required_skills?: string[];
  desired_skills?: string[];
  keywords?: string[];
  application_method?: "website" | "email" | "unknown";
  application_email?: string;
  application_url?: string;
  cover_letter_requested?: boolean;
  deadline?: string;
  // Concise analysis fields
  key_skills?: string[];
  verdict?: string;
}

export interface AssessmentAnalysis {
  summary: string;
  deliverables: string[];
  evaluation_criteria: string[];
  preparation_steps: string[];
  checklist: string[];
  estimated_effort_hours?: number;
}

export interface InterviewPrep {
  likely_questions: Array<{
    question: string;
    category: "behavioral" | "technical" | "role_specific" | "company";
    rationale?: string;
    star_answer?: string;
  }>;
  preparation_checklist: string[];
  talking_points: string[];
}

export interface Profile {
  id: string;
  display_name: string | null;
  full_name: string | null;
  target_role: string | null;
  years_experience: number | null;
  target_industries: string[] | null;
  target_companies: string[] | null;
  onboarding_complete: boolean;
  beta_approved: boolean;
  created_at: string;
  updated_at: string;
}

export interface BaseResume {
  id: string;
  user_id: string;
  title: string;
  source_file_path: string | null;
  source_file_type: string | null;
  raw_text: string | null;
  parsed_resume_json: ParsedResume | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  user_id: string;
  base_resume_id: string | null;
  company_name: string | null;
  role_title: string | null;
  location: string | null;
  job_url: string | null;
  raw_job_text: string | null;
  parsed_job_json: ParsedJob | null;
  current_status: ApplicationStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationDocument {
  id: string;
  application_id: string;
  user_id: string;
  document_type: DocumentType;
  version: number;
  title: string | null;
  storage_path: string | null;
  text_content: string | null;
  metadata_json: Record<string, unknown> | null;
  created_at: string;
}

export interface ApplicationTimelineEvent {
  id: string;
  application_id: string;
  user_id: string;
  event_type: TimelineEventType;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

export interface AssessmentRecord {
  id: string;
  application_id: string;
  user_id: string;
  source_text: string | null;
  source_file_path: string | null;
  analysis_json: AssessmentAnalysis | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewPrepRecord {
  id: string;
  application_id: string;
  user_id: string;
  interview_stage: string | null;
  generated_questions_json: InterviewPrep | null;
  preparation_notes: string | null;
  created_at: string;
  updated_at: string;
}
