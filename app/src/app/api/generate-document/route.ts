export const runtime = "edge";
export const maxDuration = 300;

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
import { RESUME_TAILOR_SYSTEM_PROMPT } from "@/lib/ai/resume-tailor-prompt";
import { encodeGenerationStreamEvent } from "@/lib/ai/generation-stream";
import {
  DOCUMENT_OUTPUT_TOKEN_LIMITS,
  DOCUMENT_STREAM_TIMEOUT_MS,
  createDocumentAiOptions,
  documentGenerationErrorMessage,
} from "@/lib/ai/document-generation-config";
import {
  applyValidatedResumeReplacements,
  createResumeFormatTemplate,
  extractResumeHeader,
  hasUsableResumeLineStructure,
  minimumResumeTailoringChanges,
  renderCoverLetterWithResumeFormat,
  type CoverLetterDraft,
} from "@/lib/ai/resume-format";
import { logTimelineEvent } from "@/lib/db/timeline";
import { logAiEvent } from "@/lib/db/ai-events";
import {
  cleanText,
  documentTypeSchema,
  MAX_ADJUST_INSTRUCTION_LENGTH,
  MAX_REQUEST_BODY_LENGTH,
  uuidSchema,
} from "@/lib/security/limits";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import type { DocumentType, ParsedJob, ParsedResume } from "@/lib/db/types";
import { assertDemoDocumentAvailable, isDemoUser } from "@/lib/demo";

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
- The candidate's name/contact header is inserted deterministically by the application from the source resume — never generate, alter, or repeat it yourself, and never copy the source resume's internal section headers (e.g. "Experience", "Education") into the letter body.
- Do not add or remove top-level fields from the JSON contract below; only tailor the wording inside "opening", each section's "paragraph", and "finalParagraph" to the job description. The document's overall shape (opening → evidence sections → closing) must stay the same regardless of role.
- Output exactly this JSON shape and no commentary: {"date":"...","recipient":["Company","Location"],"subject":"Re: Position Title","greeting":"Dear Hiring Manager,","opening":"...","sections":[{"heading":"Evidence Theme","paragraph":"..."}],"finalParagraph":"...","closing":"Sincerely,","signature":"Candidate Name"}.`;

const ADJUST_MODE_ADDENDUM = `

============================================================
ADJUSTMENT MODE
============================================================
You are revising an EXISTING document based on specific user feedback, not writing from scratch.
- Keep all existing wording and content exactly the same EXCEPT where the user's instruction below requires a change.
- Apply ONLY the requested adjustment. Do not use this as an opportunity to rewrite unrelated parts.
- Every rule above still applies in full, including the structure lock — the adjustment must not add, remove, or restructure sections.`;

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
  adjust?: { instruction: string; currentContent: string } | null,
): Promise<{ system: string; userMessage: string; maxTokens: number } | null> {
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const resumeJson = JSON.stringify(resume, null, 2);
  const jobJson = JSON.stringify(job, null, 2);
  const jobSkillTargets = Array.from(new Set([
    ...(job.key_skills ?? []),
    ...(job.required_skills ?? []),
    ...(job.desired_skills ?? []),
    ...(job.keywords ?? []),
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()))));
  if (documentType === "tailored_resume") {
    const sourceResume = adjust?.currentContent?.trim()
      ? adjust.currentContent
      : rawResumeText?.trim() ? rawResumeText : resumeToText(resume);
    const template = createResumeFormatTemplate(sourceResume);
    if (template.candidates.length === 0) {
      throw new Error("The source resume does not contain editable lines.");
    }
    const minimumChanges = adjust
      ? 1
      : minimumResumeTailoringChanges(template.candidates.length);
    return {
      system: adjust
        ? `${RESUME_TAILOR_SYSTEM_PROMPT}${ADJUST_MODE_ADDENDUM}`
        : RESUME_TAILOR_SYSTEM_PROMPT,
      maxTokens: DOCUMENT_OUTPUT_TOKEN_LIMITS.tailored_resume,
      userMessage: [
        `Editable source lines (JSON):\n${JSON.stringify(template.candidates, null, 2)}`,
        `Verified candidate resume evidence (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Ranked JD skill targets (JSON):\n${JSON.stringify(jobSkillTargets)}`,
        rawJobText ? `Raw job posting text:\n${rawJobText}` : "",
        adjust ? `User's requested adjustment (apply this to the editable lines above, changing only what it asks for):\n${adjust.instruction}` : "",
        `Return at least ${minimumChanges} truthful, material replacements. Preserve the source format and structure exactly.`,
      ].filter(Boolean).join("\n\n"),
    };
  }

  const matchedEvidence = (
    await selectResumeEvidenceSemantic(resumeToText(resume), rawJobText ?? jobToText(job))
  ).join('\n\n');

  if (documentType === "cover_letter") {
    const sourceResume = rawResumeText?.trim() ? rawResumeText : resumeToText(resume);
    const resumeHeader = extractResumeHeader(sourceResume);
    const styleKey = style && style in COVER_LETTER_STYLE_INSTRUCTIONS ? style : 'professional';
    const styleInstruction = COVER_LETTER_STYLE_INSTRUCTIONS[styleKey];
    return {
      system: `${COVER_LETTER_SYSTEM}${adjust ? ADJUST_MODE_ADDENDUM : ""}\n\nToday's date is ${today}. Use this exact date.\n\nTone instruction: ${styleInstruction}`,
      maxTokens: DOCUMENT_OUTPUT_TOKEN_LIMITS.cover_letter,
      userMessage: [
        `Exact source-resume header to be reused by the application (JSON):\n${JSON.stringify(resumeHeader)}`,
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        adjust ? `Current cover letter content (adjust this, do not regenerate from scratch):\n${adjust.currentContent}\n\nUser's requested adjustment:\n${adjust.instruction}` : "",
        "Return only the cover-letter content JSON. The application will apply the resume format.",
      ].filter(Boolean).join("\n\n"),
    };
  }

  if (documentType === "email_draft") {
    return {
      system: `${EMAIL_SYSTEM}\n\nToday's date is ${today}. Use this date if the email requires a date.`,
      maxTokens: DOCUMENT_OUTPUT_TOKEN_LIMITS.email_draft,
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
      maxTokens: DOCUMENT_OUTPUT_TOKEN_LIMITS.interview_prep,
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

  let body: { application_id?: string; document_type?: string; style?: string; adjust_instruction?: string };
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
  const adjustInstruction = cleanText(body.adjust_instruction, MAX_ADJUST_INSTRUCTION_LENGTH);

  if (!uuidSchema.safeParse(applicationId).success || !documentTypeResult.success) {
    return Response.json({ error: "Missing application_id or document_type." }, { status: 400 });
  }
  const documentType = documentTypeResult.data as DocumentType;
  const canAdjust = documentType === "tailored_resume" || documentType === "cover_letter";

  const { supabase, user } = await getOptionalUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  const isDemo = isDemoUser(user);

  const demoLimitError = await assertDemoDocumentAvailable(
    supabase,
    user,
    documentType,
    applicationId,
  );
  if (demoLimitError) {
    return Response.json({ error: demoLimitError }, { status: 403 });
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

  let adjust: { instruction: string; currentContent: string } | null = null;
  if (adjustInstruction && canAdjust) {
    const { data: existingDoc } = await supabase
      .from("application_documents")
      .select("text_content")
      .eq("application_id", applicationId)
      .eq("user_id", user.id)
      .eq("document_type", documentType)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!existingDoc?.text_content?.trim()) {
      return Response.json(
        { error: "Generate a document first, then request an adjustment." },
        { status: 400 },
      );
    }
    adjust = { instruction: adjustInstruction, currentContent: existingDoc.text_content };
  }

  const resumeBaseText = adjust?.currentContent?.trim() && documentType === "tailored_resume"
    ? adjust.currentContent
    : rawResumeText;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const startedAt = Date.now();
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const send = (event: Parameters<typeof encodeGenerationStreamEvent>[0]) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeGenerationStreamEvent(event)));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        controller.close();
      };
      const timer = setTimeout(() => {
        console.error(`[generate-document] Timeout after ${DOCUMENT_STREAM_TIMEOUT_MS}ms`);
        send({
          type: "error",
          message: "High-quality generation timed out. Please try again.",
        });
        close();
      }, DOCUMENT_STREAM_TIMEOUT_MS);

      const aiOptions = createDocumentAiOptions(DEFAULT_DOCUMENT_TEXT_MODEL, "disabled");
      const usedModel = aiOptions.model;
      let aiStartedAt = startedAt;

      try {
        send({ type: "progress", stage: "preparing", percent: 8, elapsedMs: 0 });
        const prompt = await buildPrompt(
          documentType,
          parsedResume,
          job,
          app.raw_job_text,
          rawResumeText,
          style,
          adjust,
        );
        if (!prompt) throw new Error(`Unsupported document type: ${documentType}`);

        send({
          type: "progress",
          stage: "generating",
          percent: 24,
          elapsedMs: Date.now() - startedAt,
        });
        console.log(`[generate-document] Starting ${AI_PROVIDER}:${usedModel} generation for ${documentType} (thinking=${aiOptions.thinkingMode ?? "env-default"})`);
        aiStartedAt = Date.now();
        let generationPercent = 24;
        heartbeat = setInterval(() => {
          generationPercent = Math.min(74, generationPercent + 2);
          send({
            type: "progress",
            stage: "generating",
            percent: generationPercent,
            elapsedMs: Date.now() - startedAt,
          });
        }, 6_000);

        const contentFromModel = await aiText({
          system: prompt.system,
          messages: [{ role: "user", content: prompt.userMessage }],
          maxTokens: prompt.maxTokens,
          model: aiOptions.model,
          thinkingMode: aiOptions.thinkingMode,
          allowFallback: false,
        });
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
        if (closed) return;
        send({
          type: "progress",
          stage: "validating",
          percent: 80,
          elapsedMs: Date.now() - startedAt,
        });
        let content = contentFromModel;

        if (documentType === "tailored_resume") {
          const sourceResume = resumeBaseText || resumeToText(parsedResume);
          const template = createResumeFormatTemplate(sourceResume);
          const minimumChanges = adjust
            ? 1
            : minimumResumeTailoringChanges(template.candidates.length);
          const result = extractJson<{ replacements?: Record<string, unknown> }>(content);
          content = applyValidatedResumeReplacements(
            sourceResume,
            result.replacements,
            minimumChanges,
          );
        } else if (documentType === "cover_letter") {
          const draft = extractJson<CoverLetterDraft>(content);
          content = renderCoverLetterWithResumeFormat(
            rawResumeText || resumeToText(parsedResume),
            draft,
          );
        }

        send({
          type: "progress",
          stage: "finalizing",
          percent: 94,
          elapsedMs: Date.now() - startedAt,
        });
        send({ type: "content", content });

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
        send({
          type: "progress",
          stage: "finalizing",
          percent: 100,
          elapsedMs: Date.now() - startedAt,
        });
      } catch (e) {
        clearTimeout(timer);
        if (heartbeat) clearInterval(heartbeat);
        heartbeat = null;
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
        send({
          type: "error",
          message: documentGenerationErrorMessage(e, { isDemo }),
        });
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        clearTimeout(timer);
        close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
