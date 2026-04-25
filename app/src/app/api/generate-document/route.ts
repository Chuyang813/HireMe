import { type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/current-user";
import { aiText, AI_PROVIDER, DEFAULT_MODEL, PROMPT_VERSION } from "@/lib/ai/provider";
import { logTimelineEvent } from "@/lib/db/timeline";
import { documentTypeSchema, MAX_REQUEST_BODY_LENGTH, uuidSchema } from "@/lib/security/limits";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIpFromHeaders } from "@/lib/security/request";
import type { DocumentType, ParsedJob, ParsedResume } from "@/lib/db/types";

const AI_TIMEOUT_MS = 65_000;
const AI_AUDIT_NOTE = `provider=${AI_PROVIDER} model=${DEFAULT_MODEL} prompt_version=${PROMPT_VERSION}`;

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
- [Filename.pdf] - [one short reason tying it to the posting]
- [Filename.pdf] - [one short reason tying it to the posting]

Rules for the signature block:
- Always include "Best regards," then the candidate's full name on the next line, then a single contact line.
- The contact line is "Email | Phone | Location" — drop any field that is missing from the resume (do not write "N/A" or leave blanks).
- Never fabricate contact details; pull them from the parsed resume only.

Rules for the attachments block:
- Suggest only files the candidate should actually attach for THIS posting. Do not pad the list.
- Always include the tailored resume (e.g. "[FirstName]_[LastName]_Resume.pdf").
- Include a cover letter ONLY if the parsed job has cover_letter_requested = true OR the role_summary / responsibilities / required_skills / desired_skills mention "cover letter" or "motivation letter".
- Include a transcript (e.g. "[FirstName]_[LastName]_Transcript.pdf") IF the posting mentions transcript, GPA, academic record, or "official records".
- Include a portfolio (PDF or link) IF the posting mentions portfolio, work samples, design samples, or case studies.
- Include writing samples IF the posting mentions writing samples or published work.
- Include references IF the posting requests references with the application.
- Include certifications IF the posting requires a specific certification the candidate holds.
- Each attachment line MUST use " - " before the reason and cite what in the posting prompted it (e.g. "- posting requires unofficial transcript", "- role requests design portfolio").
- Never invent a document the candidate doesn't plausibly have. If unsure, leave it out.

Other rules:
- Never fabricate experience, metrics, or employer names.
- Output only the email in the format above. No subject duplication, no signature outside the signature block, no extra prose.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  documentType: DocumentType,
  resume: ParsedResume,
  job: ParsedJob,
  rawJobText?: string | null,
): { system: string; userMessage: string; maxTokens: number } | null {
  const resumeJson = JSON.stringify(resume, null, 2);
  const jobJson = JSON.stringify(job, null, 2);

  if (documentType === "tailored_resume") {
    return {
      system: RESUME_SYSTEM,
      maxTokens: 4096,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        "Write the tailored resume as Markdown. Only output the resume.",
      ].join("\n\n"),
    };
  }

  if (documentType === "cover_letter") {
    return {
      system: COVER_LETTER_SYSTEM,
      maxTokens: 1024,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
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

  let body: { application_id?: string; document_type?: string };
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
  const prompt = buildPrompt(documentType, parsedResume, job, app.raw_job_text);
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
        const content = await aiText({
          system: prompt.system,
          messages: [{ role: "user", content: prompt.userMessage }],
          maxTokens: prompt.maxTokens,
        });

        controller.enqueue(encoder.encode(content));

        clearTimeout(timer);

        await logTimelineEvent(supabase, {
          application_id: applicationId,
          user_id: user.id,
          event_type: "document_generated",
          new_value: documentType,
          note: AI_AUDIT_NOTE,
        });
      } catch (e) {
        clearTimeout(timer);
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[generate-document] Streaming error:", msg, e);
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
