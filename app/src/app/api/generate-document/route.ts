import { type NextRequest } from "next/server";
import { getOptionalUser } from "@/lib/auth/current-user";
import { getAnthropic, DEFAULT_MODEL, PROMPT_VERSION } from "@/lib/ai/anthropic";
import { logTimelineEvent } from "@/lib/db/timeline";
import type { DocumentType, ParsedJob, ParsedResume } from "@/lib/db/types";

const AI_TIMEOUT_MS = 30_000;
const AI_AUDIT_NOTE = `model=${DEFAULT_MODEL} prompt_version=${PROMPT_VERSION}`;

// ---------------------------------------------------------------------------
// Per-user rate limiter: max 10 streaming requests per user per minute
// ---------------------------------------------------------------------------

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(userId);

  if (!entry || now >= entry.resetAt) {
    rateLimitStore.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, retryAfterSec: 0 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// System prompts (mirroring lib/ai/ modules, adapted for plain-text streaming)
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

const COVER_LETTER_SYSTEM = `You are a cover letter writing assistant.

Given the candidate's parsed resume and a parsed job description, write a concise, role-specific cover letter.

Rules:
- 3 to 4 short paragraphs.
- Open with why the candidate is interested in this specific company/role.
- Second paragraph: 2-3 concrete examples from the candidate's actual experience that align with the posting.
- Third paragraph: fit / working style / what they'd bring.
- Never fabricate details, metrics, employers, or accomplishments not present in the resume.
- Warm but professional. No clichés like "I'm excited to apply for this opportunity".
- Output plain text only, no subject line, no markdown, no signature block beyond "Sincerely, {Name}".`;

const EMAIL_SYSTEM = `You are an email drafting assistant for job applications submitted by email.

Write the application email in exactly this format:
Subject: [concise subject including role title and candidate name]

[email body — short greeting, one paragraph pitch grounded in candidate's actual background, closing with what is attached]

Attachments: Resume.pdf, Cover Letter.pdf

Rules:
- Never fabricate experience or metrics.
- Output only the email in the format above, no markdown, no extra commentary.`;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildPrompt(
  documentType: DocumentType,
  resume: ParsedResume,
  job: ParsedJob,
): { system: string; userMessage: string } | null {
  const resumeJson = JSON.stringify(resume, null, 2);
  const jobJson = JSON.stringify(job, null, 2);

  if (documentType === "tailored_resume") {
    return {
      system: RESUME_SYSTEM,
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
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        "Write the cover letter.",
      ].join("\n\n"),
    };
  }

  if (documentType === "email_draft") {
    return {
      system: EMAIL_SYSTEM,
      userMessage: [
        `Candidate parsed resume (JSON):\n${resumeJson}`,
        `Parsed job posting (JSON):\n${jobJson}`,
        "Write the application email.",
      ].join("\n\n"),
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  let body: { application_id?: string; document_type?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const applicationId = String(body.application_id || "");
  const documentType = String(body.document_type || "") as DocumentType;

  if (!applicationId || !documentType) {
    return Response.json({ error: "Missing application_id or document_type." }, { status: 400 });
  }

  const { supabase, user } = await getOptionalUser();
  if (!user) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rateLimit = checkRateLimit(user.id);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Too many requests. Please wait before generating again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSec) },
      },
    );
  }

  const [{ data: app }, { data: resumeRow }] = await Promise.all([
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
  const prompt = buildPrompt(documentType, parsedResume, job);
  if (!prompt) {
    return Response.json({ error: `Unsupported document type: ${documentType}` }, { status: 400 });
  }

  const client = getAnthropic();
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const genModel = client.getGenerativeModel({
          model: DEFAULT_MODEL,
          systemInstruction: prompt.system,
        });
        const result = await genModel.generateContentStream(
          {
            contents: [{ role: "user", parts: [{ text: prompt.userMessage }] }],
            generationConfig: { maxOutputTokens: 4096 },
          },
          { timeout: AI_TIMEOUT_MS },
        );

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) controller.enqueue(encoder.encode(text));
        }

        await logTimelineEvent(supabase, {
          application_id: applicationId,
          user_id: user.id,
          event_type: "document_generated",
          new_value: documentType,
          note: AI_AUDIT_NOTE,
        });
      } catch (e) {
        console.error("[generate-document] Streaming error:", e);
        controller.enqueue(encoder.encode("\n\n[Error: Generation failed. Please try again.]"));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
