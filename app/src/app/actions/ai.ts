"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { tailorResume } from "@/lib/ai/tailor-resume";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { generateEmailDraft } from "@/lib/ai/email-draft";
import { analyzeAssessment } from "@/lib/ai/assessment";
import { generateInterviewPrep } from "@/lib/ai/interview-prep";
import { extractTextFromUpload } from "@/lib/parsers/resume-text";
import { logTimelineEvent } from "@/lib/db/timeline";
import { claudeJson } from "@/lib/ai/anthropic";
import type {
  AssessmentAnalysis,
  DocumentType,
  InterviewPrep,
  ParsedJob,
  ParsedResume,
  ResumeScore,
} from "@/lib/db/types";

// ---------------------------------------------------------------------------
// Generate document (non-streaming fallback — kept for types; streaming is via
// the /api/generate-document route handler)
// ---------------------------------------------------------------------------

export type GenerateState =
  | { content: string; documentType: DocumentType; error?: never }
  | { error: string; content?: never; documentType?: never }
  | undefined;

export async function generateDocumentAction(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const { supabase, user } = await requireUser();

  const applicationId = String(formData.get("application_id") || "");
  const documentType = String(formData.get("document_type") || "") as DocumentType;

  if (!applicationId || !documentType) return { error: "Missing required fields." };

  const { data: app } = await supabase
    .from("job_applications")
    .select("parsed_job_json, raw_job_text")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (!app) return { error: "Application not found." };

  const job = app.parsed_job_json as ParsedJob | null;
  if (!job) return { error: "Job not yet analyzed. Try re-creating the application." };

  const { data: resume } = await supabase
    .from("base_resumes")
    .select("parsed_resume_json")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .single();

  const parsedResume = (resume?.parsed_resume_json as ParsedResume | null) ?? {};

  let content: string;
  try {
    if (documentType === "tailored_resume") {
      content = await tailorResume({ resume: parsedResume, job });
    } else if (documentType === "cover_letter") {
      content = await generateCoverLetter({ resume: parsedResume, job });
    } else if (documentType === "email_draft") {
      const draft = await generateEmailDraft({ resume: parsedResume, job });
      content = `Subject: ${draft.subject}\n\n${draft.body}\n\nAttachments: ${draft.attachments.join(", ")}`;
    } else {
      return { error: `Unsupported document type: ${documentType}` };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "AI generation failed." };
  }

  await logTimelineEvent(supabase, {
    application_id: applicationId,
    user_id: user.id,
    event_type: "document_generated",
    new_value: documentType,
  });

  return { content, documentType };
}

// ---------------------------------------------------------------------------
// Save document
// ---------------------------------------------------------------------------

export type SaveDocumentState =
  | { ok: true; documentId: string; error?: never }
  | { error: string; ok?: never }
  | undefined;

export async function saveDocumentAction(
  _prev: SaveDocumentState,
  formData: FormData,
): Promise<SaveDocumentState> {
  const { supabase, user } = await requireUser();

  const applicationId = String(formData.get("application_id") || "");
  const documentType = String(formData.get("document_type") || "") as DocumentType;
  const content = String(formData.get("content") || "");
  const existingId = String(formData.get("document_id") || "");

  if (!applicationId || !documentType) return { error: "Missing required fields." };

  if (existingId) {
    const { error } = await supabase
      .from("application_documents")
      .update({ text_content: content })
      .eq("id", existingId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, documentId: existingId };
  }

  const { data, error } = await supabase
    .from("application_documents")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      document_type: documentType,
      version: 1,
      text_content: content,
    })
    .select("id")
    .single();

  if (error || !data) return { error: error?.message ?? "Save failed." };

  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, documentId: data.id };
}

// ---------------------------------------------------------------------------
// Analyze assessment
// ---------------------------------------------------------------------------

export type AnalyzeAssessmentState =
  | { result: AssessmentAnalysis; error?: never }
  | { error: string; result?: never }
  | undefined;

export async function analyzeAssessmentAction(
  _prev: AnalyzeAssessmentState,
  formData: FormData,
): Promise<AnalyzeAssessmentState> {
  const { supabase, user } = await requireUser();

  const applicationId = String(formData.get("application_id") || "");
  const file = formData.get("file");

  if (!applicationId) return { error: "Missing application ID." };
  if (!(file instanceof File) || file.size === 0)
    return { error: "Please select a PDF, DOCX, or TXT file." };
  if (file.size > 10 * 1024 * 1024)
    return { error: "File must be 10 MB or smaller." };

  const { data: app } = await supabase
    .from("job_applications")
    .select("parsed_job_json")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (!app) return { error: "Application not found." };

  const bytes = Buffer.from(await file.arrayBuffer());
  let assessmentText: string;
  try {
    const extracted = await extractTextFromUpload(bytes, file.type, file.name);
    assessmentText = extracted.rawText;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Failed to read file." };
  }

  if (!assessmentText.trim())
    return { error: "Could not extract any text from this file." };

  let result: AssessmentAnalysis;
  try {
    result = await analyzeAssessment({
      assessmentText,
      job: app.parsed_job_json as ParsedJob | null,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Analysis failed." };
  }

  await logTimelineEvent(supabase, {
    application_id: applicationId,
    user_id: user.id,
    event_type: "assessment_added",
  });

  return { result };
}

// ---------------------------------------------------------------------------
// Generate interview prep
// ---------------------------------------------------------------------------

export type GenerateInterviewPrepState =
  | { result: InterviewPrep; error?: never }
  | { error: string; result?: never }
  | undefined;

export async function generateInterviewPrepAction(
  _prev: GenerateInterviewPrepState,
  formData: FormData,
): Promise<GenerateInterviewPrepState> {
  const { supabase, user } = await requireUser();

  const applicationId = String(formData.get("application_id") || "");
  if (!applicationId) return { error: "Missing application ID." };

  const [{ data: app }, { data: resume }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("parsed_job_json")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("base_resumes")
      .select("parsed_resume_json")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single(),
  ]);

  if (!app) return { error: "Application not found." };

  const job = app.parsed_job_json as ParsedJob | null;
  if (!job) return { error: "Job not yet analyzed. Try re-creating the application." };

  const parsedResume = (resume?.parsed_resume_json as ParsedResume | null) ?? {};

  let result: InterviewPrep;
  try {
    result = await generateInterviewPrep({ resume: parsedResume, job });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Generation failed." };
  }

  await logTimelineEvent(supabase, {
    application_id: applicationId,
    user_id: user.id,
    event_type: "interview_prep_generated",
  });

  return { result };
}

// ---------------------------------------------------------------------------
// Score resume against job description
// ---------------------------------------------------------------------------

export type ScoreResumeState =
  | { result: ResumeScore; error?: never }
  | { error: string; result?: never }
  | undefined;

export async function scoreResumeAction(
  _prev: ScoreResumeState,
  formData: FormData,
): Promise<ScoreResumeState> {
  const { supabase, user } = await requireUser();

  const applicationId = String(formData.get("application_id") || "");
  if (!applicationId) return { error: "Missing application ID." };

  const [{ data: app }, { data: resume }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("parsed_job_json, raw_job_text")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("base_resumes")
      .select("parsed_resume_json, raw_text")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single(),
  ]);

  if (!app) return { error: "Application not found." };
  if (!resume) return { error: "No default resume found. Upload one in Resumes." };

  const job = app.parsed_job_json as ParsedJob | null;
  if (!job) return { error: "Job not yet analyzed. Try re-creating the application." };

  const parsedResume = (resume.parsed_resume_json as ParsedResume | null) ?? {};
  const resumeText = resume.raw_text ?? JSON.stringify(parsedResume);
  const jobText = app.raw_job_text ?? JSON.stringify(job);

  const system = `You are an expert technical recruiter and ATS specialist.
Score how well a candidate's resume matches a job description.
Return ONLY valid JSON with this exact shape:
{
  "score": <integer 0-100>,
  "strengths": [<up to 4 short strings: what matches well>],
  "gaps": [<up to 4 short strings: missing keywords or skills>],
  "suggestions": [<exactly 3 short actionable strings to improve the resume for this role>]
}`;

  let result: ResumeScore;
  try {
    result = await claudeJson<ResumeScore>({
      system,
      messages: [
        {
          role: "user",
          content: `JOB DESCRIPTION:\n${jobText}\n\n---\n\nRESUME:\n${resumeText}`,
        },
      ],
      maxTokens: 1024,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Scoring failed." };
  }

  return { result };
}
