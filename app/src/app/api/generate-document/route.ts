export const runtime = "edge";

import { type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/current-user";
import {
  aiText,
  extractJson,
  AI_PROVIDER,
  DEFAULT_DOCUMENT_TEXT_MODEL,
} from "@/lib/ai/provider";
import { PROMPT_VERSIONS, type PromptType } from "@/lib/ai/prompt-versions";
import { selectResumeEvidenceSemantic, resumeToText, jobToText } from "@/lib/ai/evidence";
import { INTERVIEW_PREP_SYSTEM } from "@/lib/ai/interview-prep";
import {
  applyResumeReplacements,
  createResumeFormatTemplate,
  extractResumeHeader,
  hasUsableResumeLineStructure,
  renderCoverLetterWithResumeFormat,
  type CoverLetterDraft,
} from "@/lib/ai/resume-format";
import { logTimelineEvent } from "@/lib/db/timeline";
import { logAiEvent } from "@/lib/db/ai-events";
import { documentTypeSchema, MAX_REQUEST_BODY_LENGTH, uuidSchema } from "@/lib/security/limits";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import type { DocumentType, ParsedJob, ParsedResume } from "@/lib/db/types";

const AI_TIMEOUT_MS = 115_000;
function docTypeToPromptType(dt: DocumentType): PromptType {
  if (dt === 'tailored_resume') return 'resume-tailor';
  if (dt === 'cover_letter') return 'cover-letter';
  if (dt === 'email_draft') return 'email-draft';
  if (dt === 'interview_prep') return 'interview-prep';
  return 'resume-tailor';
}

function auditNote(
  promptType: PromptType,
  model: string = DEFAULT_DOCUMENT_TEXT_MODEL,
) {
  return `provider=${AI_PROVIDER} model=${model} prompt_type=${promptType} prompt_version=${PROMPT_VERSIONS[promptType]}`;
}

function getDocumentAiOptions(): {
  model?: string;
  thinkingMode?: "enabled" | "disabled";
} {
  // Document output is constrained text/JSON. A reasoning model can spend the
  // whole output budget on hidden reasoning and return an empty final answer.
  return { model: DEFAULT_DOCUMENT_TEXT_MODEL, thinkingMode: "disabled" };
}

// ---------------------------------------------------------------------------
// Style instructions
// ---------------------------------------------------------------------------

const COVER_LETTER_STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: "Write a formal business letter. Start with a direct statement of interest and qualifications.",
  story: "Open with a compelling anecdote or hook that connects the candidate's experience to the role. Use narrative structure throughout.",
  concise: "Keep the opening and close brief, and use 3 very short titled evidence sections. Total under 350 words.",
  enthusiastic: "Write with genuine enthusiasm and energy. Show passion for the company's mission. Warmer, more conversational tone while staying professional.",
};

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const RESUME_SYSTEM = `You are a resume tailoring assistant.

You will receive immutable source-resume lines and a parsed job description. Return a JSON object containing replacement text only for the supplied editable line IDs.

Absolute rules:
- Never invent employers, schools, dates, titles, degrees, certifications, tools, or accomplishments.
- Never add, remove, merge, split, or reorder lines, bullets, jobs, projects, or sections.
- Never return a replacement for an ID that was not supplied.
- Keep every factual claim intact. Rephrase only when it improves alignment with the job.
- Keep each replacement at or below the source line's approximate character length so it remains inside the original text box without changing font size, line spacing, or pagination.
- Do not include bullet symbols, indentation, Markdown, headings, or line breaks inside replacement values; the application restores those from the source template.
- If a source line should remain unchanged, omit its ID.
- Output exactly this JSON shape and no commentary: {"replacements":{"L0001":"replacement text"}}.`;

const COVER_LETTER_SYSTEM = `You are a professional cover letter writing assistant.

Return content fields for a polished cover letter. The application will deterministically render those fields using the uploaded source resume's own page size, margins, header, fonts, colors, and spacing conventions.

Rules:
- Write a specific opening, 3-4 short titled evidence sections, and a confident final paragraph. Keep the total under 450 words so it fits inside the source document's own page geometry.
- Each section heading must be concise Title Case plain text that names the evidence theme; the application will render it in bold.
- Use grounded achievements and skills alignment in each section.
- Never fabricate employers, titles, degrees, metrics, or accomplishments not in the resume.
- Reference actual details from both the resume and job description; avoid generic filler and opening clichés.
- Do not add Markdown, bullets, or formatting instructions.
- Do not assume Letter or A4 page size and do not request any visual style; the source file is the sole layout authority.
- Use a concise subject in the form "Re: Position Title".
- Output exactly this JSON shape and no commentary: {"date":"...","recipient":["Company","Location"],"subject":"Re: Position Title","greeting":"Dear Hiring Manager,","opening":"...","sections":[{"heading":"Evidence Theme","paragraph":"..."}],"finalParagraph":"...","closing":"Sincerely,","signature":"Candidate Name"}.`;

const EMAIL_SYSTEM = `You are an email drafting assistant for job applications submitted by email.

Write the application email in EXACTLY this format (plain text, no markdown, no code fences, no commentary before or after):

Subject: [concise subject including role title and candidate name]

[Greeting, e.g. "Dear Hiring Team," — use a named recipient only if the posting names one]

[One short paragraph: a grounded pitch tying the candidate's actual background to the posting. No clichés, no fabricated metrics.]

[One short closing line inviting next steps, e.g. "I'd welcome the chance to discuss how my background fits this role."]

Best regards,
[Candidate Full Name]
[Candidate Email][ | Candidate Phone if present in resume][ | Candidate Location if present in resume]

Attachments:
- [Filename.pdf] - [one short reason citing what in the posting prompted it]

SIGN-OFF RULES (mandatory — never omit):
- "Best regards," MUST appear on its own line, immediately after the closing sentence and before the Attachments section.
- The line immediately after "Best regards," must be the candidate's full name (no comma, no extra text on that line).
- The line after the name must be the contact line in the format: Email | Phone | Location — drop any field absent from the resume (never write "N/A" or leave a blank placeholder).
- Never fabricate contact details; pull them only from the parsed resume.
- Do NOT skip or abbreviate the sign-off block for any reason.

ATTACHMENT RULES — carefully read both the parsed job JSON and the raw job posting text before building this list:
1. Always include the tailored resume first: [FirstName]_[LastName]_Resume.pdf — with a one-line reason tied to the specific role.
2. Transcript: include IF the posting mentions "transcript", "GPA", "academic record", "cumulative GPA", or "official/unofficial records" → [FirstName]_[LastName]_Transcript.pdf - posting requests academic records
3. Portfolio/work samples: include IF the posting mentions "portfolio", "work samples", "project samples", "design samples", or "case studies" → Portfolio - posting requests work samples
4. Cover letter: include IF the posting explicitly mentions "cover letter" or "motivation letter" → [FirstName]_[LastName]_CoverLetter.pdf - posting requests cover letter
5. References: include IF the posting mentions "references", "reference letters", or "letters of recommendation" → References.pdf - posting requests professional references
6. Writing sample: include IF the posting mentions "writing sample", "writing portfolio", or "published work" → [FirstName]_[LastName]_WritingSample.pdf - posting requests writing sample
7. Certification: include IF the posting requires a specific certification AND the resume shows the candidate holds it → [CertName].pdf - posting requires this certification
8. DEFAULT: if rules 2–7 added NO additional document, include a cover letter as the default second item: [FirstName]_[LastName]_CoverLetter.pdf - standard professional supplement

Format every attachment line as: - [Filename or description] - [one-line reason]
Suggest only files the candidate can plausibly provide. Do not pad the list.

OTHER RULES:
- Never fabricate employers, titles, degrees, metrics, or accomplishments.
- Output only the email in the exact format above. No extra prose, no duplicate subject line, no commentary.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

async function buildPrompt(
  documentType: DocumentType,
  resume: ParsedResume,
  job: ParsedJob,
  rawJobText?: string | null,
  rawResumeText?: string | null,
  style?: string,
): Promise<{ system: string; userMessage: string; maxTokens: number } | null> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const resumeJson = JSON.stringify(resume, null, 2);
  const jobJson = JSON.stringify(job, null, 2);
  const matchedEvidence = (
    await selectResumeEvidenceSemantic(resumeToText(resume), rawJobText ?? jobToText(job))
  ).join('\n\n');

  if (documentType === "tailored_resume") {
    const sourceResume = rawResumeText?.trim() ? rawResumeText : resumeToText(resume);
    const template = createResumeFormatTemplate(sourceResume);
    return {
      system: RESUME_SYSTEM,
      maxTokens: 4096,
      userMessage: [
        `Editable source lines (JSON):\n${JSON.stringify(template.candidates, null, 2)}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        "Return only the replacement-map JSON. Preserve the source format and structure exactly.",
      ].join("\n\n"),
    };
  }

  if (documentType === "cover_letter") {
    const sourceResume = rawResumeText?.trim() ? rawResumeText : resumeToText(resume);
    const resumeHeader = extractResumeHeader(sourceResume);
    const styleKey = style && style in COVER_LETTER_STYLE_INSTRUCTIONS ? style : 'professional';
    const styleInstruction = COVER_LETTER_STYLE_INSTRUCTIONS[styleKey];
    return {
      system: `${COVER_LETTER_SYSTEM}\n\nToday's date is ${today}. Use this exact date.\n\nTone instruction: ${styleInstruction}`,
      maxTokens: 2048,
      userMessage: [
        `Exact source-resume header to be reused by the application (JSON):\n${JSON.stringify(resumeHeader)}`,
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        "Return only the cover-letter content JSON. The application will apply the resume format.",
      ].join("\n\n"),
    };
  }

  if (documentType === "email_draft") {
    return {
      system: `${EMAIL_SYSTEM}\n\nToday's date is ${today}. Use this date if the email requires a date.`,
      maxTokens: 512,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        rawJobText ? `Raw job posting text:\n${rawJobText}` : "",
        "Write the application email. Tailor the attachments list to what THIS posting actually asks for.",
      ].filter(Boolean).join("\n\n"),
    };
  }

  if (documentType === "interview_prep") {
    return {
      system: `${INTERVIEW_PREP_SYSTEM}\n\nToday's date is ${today}.`,
      maxTokens: 6000,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        "Write the comprehensive interview preparation guide in Markdown.",
      ].join("\n\n"),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const contentLength = Number(req.headers.get("content-length") || "0");
  if (contentLength > MAX_REQUEST_BODY_LENGTH) {
    return Response.json({ error: "Request body is too large." }, { status: 413 });
  }

  let body: { application_id?: string; document_type?: string; style?: string };
  try {
    const rawBody = await req.text();
    if (rawBody.length > MAX_REQUEST_BODY_LENGTH) {
      return Response.json({ error: "Request body is too large." }, { status: 413 });
    }
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const applicationId = String(body.application_id || "");
  const documentTypeResult = documentTypeSchema.safeParse(body.document_type);
  const style = typeof body.style === 'string' ? body.style : 'professional';

  if (!uuidSchema.safeParse(applicationId).success || !documentTypeResult.success) {
    return Response.json({ error: "Missing application_id or document_type." }, { status: 400 });
  }
  const documentType = documentTypeResult.data as DocumentType;

  const { supabase, user } = await getOptionalUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const ip = getClientIpFromHeaders(req.headers);
  const userLimit = checkRateLimit(`generate:user:${user.id}`, { max: 8, windowMs: 60_000 });
  const ipLimit = checkRateLimit(`generate:ip:${ip}`, { max: 30, windowMs: 60_000 });
  const retryAfterSec = Math.max(userLimit.retryAfterSec, ipLimit.retryAfterSec);
  if (!userLimit.allowed || !ipLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait before generating again." },
      {
        status: 429,
        headers: { "Retry-After": String(retryAfterSec) },
      },
    );
  }

  const { data: app } = await supabase
    .from("job_applications")
    .select("parsed_job_json, raw_job_text, base_resume_id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();

  if (!app) {
    return Response.json({ error: "Application not found." }, { status: 404 });
  }

  const resumeQuery = supabase
    .from("base_resumes")
    .select("parsed_resume_json, raw_text, source_file_type")
    .eq("user_id", user.id);
  const { data: resumeRow } = app.base_resume_id
    ? await resumeQuery.eq("id", app.base_resume_id).single()
    : await resumeQuery.eq("is_default", true).single();

  const job = app.parsed_job_json as ParsedJob | null;
  if (!job) {
    return Response.json(
      { error: "Job not yet analyzed. Try re-creating the application." },
      { status: 422 },
    );
  }

  const parsedResume = (resumeRow?.parsed_resume_json as ParsedResume | null) ?? {};
  const storedResumeText = resumeRow?.raw_text ?? "";
  const rawResumeText = resumeRow?.source_file_type === "txt"
    || hasUsableResumeLineStructure(storedResumeText)
    ? storedResumeText
    : resumeToText(parsedResume);
  const prompt = await buildPrompt(
    documentType,
    parsedResume,
    job,
    app.raw_job_text,
    rawResumeText,
    style,
  );
  if (!prompt) {
    return Response.json({ error: `Unsupported document type: ${documentType}` }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const timer = setTimeout(() => {
        console.error(`[generate-document] Timeout after ${AI_TIMEOUT_MS}ms`);
        controller.enqueue(encoder.encode("\n\n[Error: Generation timed out. Please try again.]"));
        controller.close();
      }, AI_TIMEOUT_MS);

      const aiOptions = getDocumentAiOptions();
      const usedModel = aiOptions.model ?? DEFAULT_DOCUMENT_TEXT_MODEL;

      try {
        console.log(`[generate-document] Starting ${AI_PROVIDER}:${usedModel} generation for ${documentType} (thinking=${aiOptions.thinkingMode ?? "env-default"})`);
        const aiStartedAt = Date.now();

        const contentFromModel = await aiText({
          system: prompt.system,
          messages: [{ role: "user", content: prompt.userMessage }],
          maxTokens: prompt.maxTokens,
          model: aiOptions.model,
          thinkingMode: aiOptions.thinkingMode,
        });
        let content = contentFromModel;

        if (documentType === "tailored_resume") {
          try {
            const result = extractJson<{ replacements?: Record<string, unknown> }>(content);
            content = applyResumeReplacements(rawResumeText || resumeToText(parsedResume), result.replacements);
          } catch {
            // Formatting is a hard constraint. If the model ignores the JSON
            // contract, return the untouched source instead of a reformatted resume.
            content = rawResumeText || resumeToText(parsedResume);
          }
        } else if (documentType === "cover_letter") {
          const draft = extractJson<CoverLetterDraft>(content);
          content = renderCoverLetterWithResumeFormat(
            rawResumeText || resumeToText(parsedResume),
            draft,
          );
        }

        controller.enqueue(encoder.encode(content));

        clearTimeout(timer);

        const pt = docTypeToPromptType(documentType);
        await logAiEvent(supabase, {
          user_id: user.id,
          application_id: applicationId,
          event_type: "document_generation_stream",
          provider: AI_PROVIDER,
          model: usedModel,
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
          note: auditNote(pt, usedModel),
        });
      } catch (e) {
        clearTimeout(timer);
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[generate-document] Streaming error:", msg, e);
        const pt = docTypeToPromptType(documentType);
        await logAiEvent(supabase, {
          user_id: user.id,
          application_id: applicationId,
          event_type: "document_generation_stream",
          provider: AI_PROVIDER,
          model: usedModel,
          prompt_type: pt,
          prompt_version: PROMPT_VERSIONS[pt],
          document_type: documentType,
          success: false,
          error_message: msg,
        });
        controller.enqueue(
          encoder.encode("\n\n[Error: Generation failed. Please try again shortly.]"),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
