"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/current-user";
import { tailorResume } from "@/lib/ai/tailor-resume";
import { generateCoverLetter } from "@/lib/ai/cover-letter";
import { generateEmailDraft } from "@/lib/ai/email-draft";
import { analyzeAssessment } from "@/lib/ai/assessment";
import { generateInterviewPrep } from "@/lib/ai/interview-prep";
import {
  checkGeneratedDocumentGrounding,
  type GroundingWarning,
} from "@/lib/ai/grounding";
import { extractTextFromUpload } from "@/lib/parsers/resume-text";
import { logTimelineEvent } from "@/lib/db/timeline";
import { logAiEvent } from "@/lib/db/ai-events";
import { aiJson, AI_PROVIDER, DEFAULT_MODEL } from "@/lib/ai/provider";
import { PROMPT_VERSIONS, type PromptType } from "@/lib/ai/prompt-versions";
import { resumeScoreSchema } from "@/lib/ai/schemas";
import {
  cleanText,
  documentTypeSchema,
  MAX_GENERATED_DOCUMENT_LENGTH,
  uuidSchema,
} from "@/lib/security/limits";
import { checkRateLimit } from "@/lib/security/rate-limit";
import type {
  AssessmentAnalysis,
  DocumentType,
  InterviewPrep,
  ParsedJob,
  ParsedResume,
  ResumeScore,
} from "@/lib/db/types";

function auditNote(promptType: PromptType) {
  return `provider=${AI_PROVIDER} model=${DEFAULT_MODEL} prompt_type=${promptType} prompt_version=${PROMPT_VERSIONS[promptType]}`;
}

function docTypeToPromptType(dt: DocumentType): PromptType {
  if (dt === 'tailored_resume') return 'resume-tailor';
  if (dt === 'cover_letter') return 'cover-letter';
  if (dt === 'email_draft') return 'email-draft';
  return 'resume-tailor';
}

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
  const documentTypeResult = documentTypeSchema.safeParse(formData.get("document_type"));

  if (!uuidSchema.safeParse(applicationId).success || !documentTypeResult.success) {
    return { error: "Missing required fields." };
  }
  const documentType = documentTypeResult.data as DocumentType;

  const limit = checkRateLimit(`generate-document-action:${user.id}`, {
    max: 20,
    windowMs: 60 * 60_000,
  });
  if (!limit.allowed) {
    return { error: `Too many document generations. Try again in ${limit.retryAfterSec}s.` };
  }

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
  const aiStartedAt = Date.now();
  try {
    if (documentType === "tailored_resume") {
      content = await tailorResume({ resume: parsedResume, job });
    } else if (documentType === "cover_letter") {
      content = await generateCoverLetter({ resume: parsedResume, job });
    } else if (documentType === "email_draft") {
      const draft = await generateEmailDraft({
        resume: parsedResume,
        job,
        rawJobText: app.raw_job_text,
      });
      const attachments = draft.attachments
        .map((item) => `- ${item.name}${item.reason ? ` - ${item.reason}` : ""}`)
        .join("\n");
      content = [
        `Subject: ${draft.subject}`,
        draft.body,
        draft.signature,
        attachments ? `Attachments:\n${attachments}` : "",
      ].filter(Boolean).join("\n\n");
    } else {
      return { error: `Unsupported document type: ${documentType}` };
    }
  } catch (e) {
    console.error("[generateDocumentAction] AI error:", e);
    const pt = docTypeToPromptType(documentType);
    await logAiEvent(supabase, {
      user_id: user.id,
      application_id: applicationId,
      event_type: "document_generation",
      provider: AI_PROVIDER,
      model: DEFAULT_MODEL,
      prompt_type: pt,
      prompt_version: PROMPT_VERSIONS[pt],
      document_type: documentType,
      latency_ms: Date.now() - aiStartedAt,
      success: false,
      error_message: e instanceof Error ? e.message : String(e),
    });
    return { error: "AI generation failed. Please try again." };
  }

  const pt = docTypeToPromptType(documentType);
  await logAiEvent(supabase, {
    user_id: user.id,
    application_id: applicationId,
    event_type: "document_generation",
    provider: AI_PROVIDER,
    model: DEFAULT_MODEL,
    prompt_type: pt,
    prompt_version: PROMPT_VERSIONS[pt],
    document_type: documentType,
    latency_ms: Date.now() - aiStartedAt,
    success: true,
  });

  await logTimelineEvent(supabase, {
    application_id: applicationId,
    user_id: user.id,
    event_type: "document_generated",
    new_value: documentType,
    note: auditNote(pt),
  });

  return { content, documentType };
}

// ---------------------------------------------------------------------------
// Save document
// ---------------------------------------------------------------------------

export type SaveDocumentState =
  | { ok: true; documentId: string; groundingWarnings: GroundingWarning[]; error?: never }
  | { error: string; ok?: never }
  | undefined;

export async function saveDocumentAction(
  _prev: SaveDocumentState,
  formData: FormData,
): Promise<SaveDocumentState> {
  const { supabase, user } = await requireUser();

  const applicationId = String(formData.get("application_id") || "");
  const documentTypeResult = documentTypeSchema.safeParse(formData.get("document_type"));
  const content = cleanText(formData.get("content"), MAX_GENERATED_DOCUMENT_LENGTH);
  const existingId = String(formData.get("document_id") || "");

  if (!uuidSchema.safeParse(applicationId).success || !documentTypeResult.success) {
    return { error: "Missing required fields." };
  }
  if (existingId && !uuidSchema.safeParse(existingId).success) {
    return { error: "Invalid document ID." };
  }
  const documentType = documentTypeResult.data as DocumentType;

  const [{ data: app }, { data: resume }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("id, parsed_job_json, raw_job_text")
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

  const groundingWarnings = checkGeneratedDocumentGrounding({
    content,
    documentType,
    resume: (resume?.parsed_resume_json as ParsedResume | null) ?? {},
    rawResumeText: resume?.raw_text,
    job: app.parsed_job_json as ParsedJob | null,
    rawJobText: app.raw_job_text,
  });

  const metadata = {
    grounding_warnings: groundingWarnings,
    grounding_checked_at: new Date().toISOString(),
  };

  if (existingId) {
    // Archive the current content before overwriting.
    const { data: existing } = await supabase
      .from("application_documents")
      .select("text_content")
      .eq("id", existingId)
      .eq("user_id", user.id)
      .single();
    if (existing?.text_content) {
      await supabase
        .from("document_versions")
        .insert({ document_id: existingId, content: existing.text_content });
    }

    const { error } = await supabase
      .from("application_documents")
      .update({ text_content: content, metadata_json: metadata })
      .eq("id", existingId)
      .eq("user_id", user.id);
    if (error) {
      console.error("[saveDocumentAction] Update error:", error);
      return { error: "Failed to save document. Please try again." };
    }
    revalidatePath(`/applications/${applicationId}`);
    return { ok: true, documentId: existingId, groundingWarnings };
  }

  const { data, error } = await supabase
    .from("application_documents")
    .insert({
      application_id: applicationId,
      user_id: user.id,
      document_type: documentType,
      version: 1,
      text_content: content,
      metadata_json: metadata,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[saveDocumentAction] Insert error:", error);
    return { error: "Failed to save document. Please try again." };
  }

  revalidatePath(`/applications/${applicationId}`);
  return { ok: true, documentId: data.id, groundingWarnings };
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

  if (!uuidSchema.safeParse(applicationId).success) return { error: "Missing application ID." };
  if (!(file instanceof File) || file.size === 0)
    return { error: "Please select a PDF, DOCX, or TXT file." };
  if (file.size > 10 * 1024 * 1024)
    return { error: "File must be 10 MB or smaller." };
  if (!isAllowedUpload(file)) {
    return { error: "Please upload a PDF, DOCX, or TXT file." };
  }

  const limit = checkRateLimit(`assessment:${user.id}`, { max: 10, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many assessment analyses. Try again in ${limit.retryAfterSec}s.` };
  }

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
    console.error("[analyzeAssessmentAction] File extraction error:", e);
    return { error: "Failed to read the file. Please try a different format." };
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
    console.error("[analyzeAssessmentAction] AI error:", e);
    return { error: "Analysis failed. Please try again." };
  }

  await logTimelineEvent(supabase, {
    application_id: applicationId,
    user_id: user.id,
    event_type: "assessment_added",
    note: auditNote('assessment'),
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
  if (!uuidSchema.safeParse(applicationId).success) return { error: "Missing application ID." };

  const limit = checkRateLimit(`interview-prep:${user.id}`, { max: 20, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many interview prep generations. Try again in ${limit.retryAfterSec}s.` };
  }

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
    console.error("[generateInterviewPrepAction] AI error:", e);
    return { error: "Generation failed. Please try again." };
  }

  await logTimelineEvent(supabase, {
    application_id: applicationId,
    user_id: user.id,
    event_type: "interview_prep_generated",
    note: auditNote('interview-prep'),
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
  if (!uuidSchema.safeParse(applicationId).success) return { error: "Missing application ID." };

  const limit = checkRateLimit(`score-resume:${user.id}`, { max: 20, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many scoring requests. Try again in ${limit.retryAfterSec}s.` };
  }

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
    const raw = await aiJson<ResumeScore>({
      system,
      messages: [
        {
          role: "user",
          content: `JOB DESCRIPTION:\n${jobText}\n\n---\n\nRESUME:\n${resumeText}`,
        },
      ],
      maxTokens: 1024,
    });
    const validated = resumeScoreSchema.safeParse(raw);
    if (!validated.success) {
      console.error("[scoreResumeAction] Schema validation failed:", validated.error);
      return { error: "Something went wrong. Please try again." };
    }
    result = validated.data;
  } catch (e) {
    console.error("[scoreResumeAction] AI error:", e);
    return { error: "Something went wrong. Please try again." };
  }

  return { result };
}

// ---------------------------------------------------------------------------
// Fetch document version history
// ---------------------------------------------------------------------------

export interface DocumentVersion {
  id: string;
  content: string;
  created_at: string;
}

export type GetDocumentVersionsState =
  | { versions: DocumentVersion[] }
  | { error: string };

export async function getDocumentVersionsAction(
  documentId: string,
): Promise<GetDocumentVersionsState> {
  const { supabase } = await requireUser();
  if (!uuidSchema.safeParse(documentId).success) {
    return { error: "Invalid document ID." };
  }
  const { data, error } = await supabase
    .from("document_versions")
    .select("id, content, created_at")
    .eq("document_id", documentId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("[getDocumentVersionsAction] Error:", error);
    return { error: "Failed to load history." };
  }
  return { versions: (data ?? []) as DocumentVersion[] };
}

function isAllowedUpload(file: File) {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return (
    type === "application/pdf" ||
    type === "text/plain" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".pdf") ||
    name.endsWith(".txt") ||
    name.endsWith(".docx")
  );
}
