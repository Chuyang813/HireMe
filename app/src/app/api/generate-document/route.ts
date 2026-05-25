import { type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/current-user";
import { aiText, AI_PROVIDER, DEFAULT_MODEL } from "@/lib/ai/provider";
import { PROMPT_VERSIONS, type PromptType } from "@/lib/ai/prompt-versions";
import { selectResumeEvidenceSemantic, resumeToText, jobToText } from "@/lib/ai/evidence";
import { logTimelineEvent } from "@/lib/db/timeline";
import { logAiEvent } from "@/lib/db/ai-events";
import { documentTypeSchema, MAX_REQUEST_BODY_LENGTH, uuidSchema } from "@/lib/security/limits";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import type { DocumentType, ParsedJob, ParsedResume } from "@/lib/db/types";

const AI_TIMEOUT_MS = 65_000;

function docTypeToPromptType(dt: DocumentType): PromptType {
  if (dt === 'tailored_resume') return 'resume-tailor';
  if (dt === 'cover_letter') return 'cover-letter';
  if (dt === 'email_draft') return 'email-draft';
  return 'resume-tailor';
}

function auditNote(promptType: PromptType) {
  return `provider=${AI_PROVIDER} model=${DEFAULT_MODEL} prompt_type=${promptType} prompt_version=${PROMPT_VERSIONS[promptType]}`;
}

// ---------------------------------------------------------------------------
// Style instructions
// ---------------------------------------------------------------------------

const RESUME_STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: "Write in a formal, achievement-focused tone. Lead every bullet with a strong action verb. Quantify achievements with metrics wherever possible.",
  concise: "Be extremely concise. Every bullet must be under 15 words. Aim for a 1-page result. Cut any sentence that doesn't directly demonstrate value.",
  creative: "Use a slightly warmer, more personal tone. Show personality while staying professional. Good for startups and creative industries. The summary section should feel human and memorable.",
  academic: "Prioritize Education and Publications/Research sections. Use formal academic tone. List technical skills comprehensively. Publications and projects before work experience if available.",
};

const COVER_LETTER_STYLE_INSTRUCTIONS: Record<string, string> = {
  professional: "Write a formal business letter. Start with a direct statement of interest and qualifications.",
  story: "Open with a compelling anecdote or hook that connects the candidate's experience to the role. Use narrative structure throughout.",
  concise: "Write exactly 3 short paragraphs: (1) who I am and the role, (2) my top 2 relevant achievements, (3) next steps. Total under 200 words.",
  enthusiastic: "Write with genuine enthusiasm and energy. Show passion for the company's mission. Warmer, more conversational tone while staying professional.",
};

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const RESUME_SYSTEM = `You are a resume tailoring assistant.

You will receive a candidate's parsed resume and a parsed job description. Produce a tailored, role-aligned resume in clean plaintext Markdown.

Absolute rules:
- Never invent employers, schools, dates, titles, degrees, certifications, tools, or accomplishments.
- You may reorganize, reprioritize, and rephrase bullets the candidate already has. You may drop weakly-relevant items.
- Highlight experience, projects, and skills that align with the job's required and desired skills.
- Keep the candidate's factual claims intact; only the framing changes.
- Use simple Markdown: # Name, contact line, ## Sections, - bullets.
- Do not include any preamble or trailing commentary. Output only the resume.`;

const COVER_LETTER_SYSTEM = `You are a professional cover letter writing assistant.

Given the candidate's parsed resume and a parsed job description, write a complete, polished cover letter that a hiring manager would be impressed to receive.

Structure (output as clean Markdown):

[Candidate Name]
[Email] | [Phone if available] | [Location if available]
[Today's date]

[Company Name]
[Company City/Location if known]

Dear Hiring Manager,

**Opening paragraph** — A strong, specific hook: why this candidate is genuinely excited about this company and role. Reference something concrete about the company or the role that makes it distinctive. Not generic.

**Body paragraph 1** — Most relevant experience: 1-2 specific achievements with numbers or tangible impact drawn directly from the resume. Show what the candidate has actually done that maps to the job requirements.

**Body paragraph 2** — Skills alignment and fit: connect the candidate's specific skill set to the job's key requirements. Add one sentence about working style or cultural fit if supported by the resume.

**Closing paragraph** — Confident, forward-looking close: express enthusiasm, invite next steps, thank the reader.

Sincerely,
[Candidate Full Name]

Rules:
- 4-5 paragraphs, 400-500 words total. Complete and professional — not a stub.
- Never fabricate employers, titles, degrees, metrics, or accomplishments not in the resume.
- Reference actual details from both the resume and job description — no generic filler.
- Professional but warm tone. No clichés like "I'm writing to express my interest" or "I'm excited to apply".
- Use clean Markdown: blank lines between each section block, bold for paragraph labels removed in final output.
- Output the full letter only — no commentary, no subject line, no notes.`;

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
  style?: string,
): Promise<{ system: string; userMessage: string; maxTokens: number } | null> {
  const resumeJson = JSON.stringify(resume, null, 2);
  const jobJson = JSON.stringify(job, null, 2);
  const matchedEvidence = (
    await selectResumeEvidenceSemantic(resumeToText(resume), rawJobText ?? jobToText(job))
  ).join('\n\n');

  if (documentType === "tailored_resume") {
    const styleKey = style && style in RESUME_STYLE_INSTRUCTIONS ? style : 'professional';
    const styleInstruction = RESUME_STYLE_INSTRUCTIONS[styleKey];
    return {
      system: `${RESUME_SYSTEM}\n\nStyle instruction: ${styleInstruction}`,
      maxTokens: 4096,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        "Write the tailored resume as Markdown. Only output the resume.",
      ].join("\n\n"),
    };
  }

  if (documentType === "cover_letter") {
    const styleKey = style && style in COVER_LETTER_STYLE_INSTRUCTIONS ? style : 'professional';
    const styleInstruction = COVER_LETTER_STYLE_INSTRUCTIONS[styleKey];
    return {
      system: `${COVER_LETTER_SYSTEM}\n\nStyle instruction: ${styleInstruction}`,
      maxTokens: 1024,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        "Write the complete cover letter.",
      ].join("\n\n"),
    };
  }

  if (documentType === "email_draft") {
    return {
      system: EMAIL_SYSTEM,
      maxTokens: 900,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
        rawJobText ? `Raw job posting text:\n${rawJobText}` : "",
        "Write the application email. Tailor the attachments list to what THIS posting actually asks for.",
      ].filter(Boolean).join("\n\n"),
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

  const [{ data: app }, { data: resumeRow }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("parsed_job_json, raw_job_text")
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

  if (!app) {
    return Response.json({ error: "Application not found." }, { status: 404 });
  }

  const job = app.parsed_job_json as ParsedJob | null;
  if (!job) {
    return Response.json(
      { error: "Job not yet analyzed. Try re-creating the application." },
      { status: 422 },
    );
  }

  const parsedResume = (resumeRow?.parsed_resume_json as ParsedResume | null) ?? {};
  const prompt = await buildPrompt(documentType, parsedResume, job, app.raw_job_text, style);
  if (!prompt) {
    return Response.json({ error: `Unsupported document type: ${documentType}` }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const timer = setTimeout(() => {
        console.error("[generate-document] Timeout after 30s");
        controller.enqueue(encoder.encode("\n\n[Error: Generation timed out. Please try again.]"));
        controller.close();
      }, AI_TIMEOUT_MS);

      try {
        console.log(`[generate-document] Starting ${AI_PROVIDER} generation for ${documentType}`);
        const aiStartedAt = Date.now();
        const content = await aiText({
          system: prompt.system,
          messages: [{ role: "user", content: prompt.userMessage }],
          maxTokens: prompt.maxTokens,
        });

        controller.enqueue(encoder.encode(content));

        clearTimeout(timer);

        const pt = docTypeToPromptType(documentType);
        await logAiEvent(supabase, {
          user_id: user.id,
          application_id: applicationId,
          event_type: "document_generation_stream",
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
          model: DEFAULT_MODEL,
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
