"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { parseJobPosting } from "@/lib/ai/job-parser";
import { embedText, shouldUseSemanticEvidence } from "@/lib/ai/embeddings";
import { computeSkillMatch, type SkillMatch } from "@/lib/ai/skill-match";
import { logTimelineEvent } from "@/lib/db/timeline";
import {
  applicationStatusSchema,
  cleanSingleLine,
  cleanText,
  MAX_JOB_TEXT_LENGTH,
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  validateSafeHttpUrl,
  uuidSchema,
} from "@/lib/security/limits";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import type { ApplicationStatus, ParsedJob } from "@/lib/db/types";
import { assertDemoApplicationAvailable } from "@/lib/demo";

export type CreateApplicationState = { error?: string } | undefined;
export type AnalyzeJobState =
  | { parsed?: ParsedJob; rawJobText?: string; skillMatch?: SkillMatch | null; error?: string }
  | undefined;

const MIN_FETCHED_JOB_TEXT_LENGTH = 300;

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function extractTextFromHtml(html: string): string {
  return decodeBasicEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<\/(p|div|section|article|li|h[1-6]|br|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  );
}

function normalizeFetchedJobText(value: string): string {
  const markdownContent = value.match(/Markdown Content:\s*([\s\S]*)/i)?.[1] ?? value;
  return cleanText(markdownContent, MAX_JOB_TEXT_LENGTH)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function looksLikeJobPosting(text: string): boolean {
  const normalized = text.toLowerCase();
  const signals = [
    "job",
    "role",
    "responsibilities",
    "requirements",
    "qualifications",
    "skills",
    "experience",
    "apply",
    "position",
    "about the",
  ];
  const signalCount = signals.filter((signal) => normalized.includes(signal)).length;
  return text.length >= MIN_FETCHED_JOB_TEXT_LENGTH && signalCount >= 2;
}

async function fetchReadableText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,text/plain,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 HireMe/1.0",
    },
    signal: AbortSignal.timeout(7000),
    redirect: "follow",
  });
  if (!response.ok) return "";

  const contentType = response.headers.get("content-type") || "";
  if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) return "";

  const body = await response.text();
  const readable = /text\/html|application\/xhtml\+xml/i.test(contentType)
    ? extractTextFromHtml(body)
    : body;
  return normalizeFetchedJobText(readable);
}

async function fetchReaderText(url: string): Promise<string> {
  const readerUrl = `https://r.jina.ai/http://${url}`;
  const response = await fetch(readerUrl, {
    headers: {
      Accept: "text/plain",
      "User-Agent": "HireMe/1.0",
    },
    signal: AbortSignal.timeout(12000),
    redirect: "follow",
  });
  if (!response.ok) return "";
  return normalizeFetchedJobText(await response.text());
}

async function fetchJobTextFromUrl(jobUrl: string): Promise<string> {
  let best = "";

  try {
    const directText = await fetchReadableText(jobUrl);
    if (looksLikeJobPosting(directText)) return directText;
    best = directText;
  } catch {
    best = "";
  }

  try {
    const readerText = await fetchReaderText(jobUrl);
    if (looksLikeJobPosting(readerText)) return readerText;
    if (readerText.length > best.length) best = readerText;
  } catch {
    // Job boards often block direct access. The caller will show a paste fallback.
  }

  return looksLikeJobPosting(best) ? best : "";
}

export async function analyzeJobAction(
  _prev: AnalyzeJobState,
  formData: FormData,
): Promise<AnalyzeJobState> {
  const { supabase, user } = await requireUser();
  const demoLimitError = await assertDemoApplicationAvailable(supabase, user);
  if (demoLimitError) return { error: demoLimitError };
  const requestedResumeId = String(formData.get("base_resume_id") || "");
  if (requestedResumeId && !uuidSchema.safeParse(requestedResumeId).success) {
    return { error: "Please select a valid base resume." };
  }
  const resumeQuery = supabase
    .from("base_resumes")
    .select("id, parsed_resume_json, raw_text")
    .eq("user_id", user.id);
  const { data: selectedResume } = requestedResumeId
    ? await resumeQuery.eq("id", requestedResumeId).maybeSingle()
    : await resumeQuery.eq("is_default", true).limit(1).maybeSingle();
  if (!selectedResume) {
    return { error: "Please upload a base resume before creating an application." };
  }

  const ip = await getClientIp();
  const limit = checkRateLimit(`analyze:${user.id}:${ip}`, { max: 8, windowMs: 60_000 });
  if (!limit.allowed) {
    return { error: `Too many analysis requests. Try again in ${limit.retryAfterSec}s.` };
  }

  let rawJobText = cleanText(formData.get("raw_job_text"), MAX_JOB_TEXT_LENGTH);
  const jobUrlResult = validateSafeHttpUrl(formData.get("job_url"));
  if (!jobUrlResult.ok) return { error: jobUrlResult.error };
  const jobUrl = jobUrlResult.url;

  if (!rawJobText && jobUrl) {
    rawJobText = await fetchJobTextFromUrl(jobUrl);
  }

  if (!rawJobText && jobUrl) {
    return {
      error:
        "Couldn't fetch enough readable text from that URL. Some job boards block automated access, so please paste the job description directly.",
    };
  }

  if (!rawJobText) return { error: "Please paste the job description." };
  try {
    const parsed = await parseJobPosting(rawJobText);
    const skillMatch = computeSkillMatch(
      selectedResume.parsed_resume_json,
      selectedResume.raw_text,
      parsed,
      rawJobText,
    );
    return { parsed, rawJobText, skillMatch };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[analyzeJobAction] parseJobPosting failed:", msg, e);
    if (msg.includes("GEMINI_API_KEY") || msg.includes("DEEPSEEK_API_KEY")) {
      return { error: "AI service is not configured. Please contact support." };
    }
    if (msg.includes("429") || msg.toLowerCase().includes("quota exceeded")) {
      return {
        error:
          "AI provider quota exceeded for this API key. Please enable billing or use a key/project with available quota.",
      };
    }
    if (msg.includes("Rate limit")) {
      return { error: msg };
    }
    return { error: "AI analysis failed. Please try again." };
  }
}

export async function createApplicationAction(
  _prev: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  const { supabase, user } = await requireUser();
  const demoLimitError = await assertDemoApplicationAvailable(supabase, user);
  if (demoLimitError) return { error: demoLimitError };

  const requestedResumeId = String(formData.get("base_resume_id") || "");
  if (requestedResumeId && !uuidSchema.safeParse(requestedResumeId).success) {
    return { error: "Please select a valid base resume." };
  }
  const resumeQuery = supabase
    .from("base_resumes")
    .select("id")
    .eq("user_id", user.id);
  const { data: selectedResume } = requestedResumeId
    ? await resumeQuery.eq("id", requestedResumeId).maybeSingle()
    : await resumeQuery.eq("is_default", true).limit(1).maybeSingle();
  if (!selectedResume) {
    return { error: "Please upload a base resume before creating an application." };
  }

  const createLimit = checkRateLimit(`create-application:${user.id}`, {
    max: 30,
    windowMs: 60 * 60_000,
  });
  if (!createLimit.allowed) {
    return { error: `Too many applications created. Try again in ${createLimit.retryAfterSec}s.` };
  }

  const companyName = cleanSingleLine(formData.get("company_name"), MAX_TITLE_LENGTH);
  const roleTitle = cleanSingleLine(formData.get("role_title"), MAX_TITLE_LENGTH);
  const jobUrlResult = validateSafeHttpUrl(formData.get("job_url"));
  if (!jobUrlResult.ok) return { error: jobUrlResult.error };
  const jobUrl = jobUrlResult.url;
  const rawJobText = cleanText(formData.get("raw_job_text"), MAX_JOB_TEXT_LENGTH);
  const parsedJobRaw = cleanText(formData.get("parsed_job_json"), MAX_JOB_TEXT_LENGTH);

  if (!rawJobText) return { error: "Please paste the job description." };

  // Use pre-parsed data from review step if available, otherwise parse fresh
  let parsedJob: ParsedJob | null = null;
  if (parsedJobRaw) {
    try {
      parsedJob = JSON.parse(parsedJobRaw) as ParsedJob;
    } catch {
      // malformed JSON — fall through to re-parse
    }
  }
  if (!parsedJob) {
    try {
      parsedJob = await parseJobPosting(rawJobText);
    } catch {
      // best-effort; continue without parsed data
    }
  }

  const { data, error } = await supabase
    .from("job_applications")
    .insert({
      user_id: user.id,
      company_name: companyName || parsedJob?.company_name || null,
      role_title: roleTitle || parsedJob?.role_title || null,
      base_resume_id: selectedResume.id,
      location: parsedJob?.location ?? null,
      job_url: jobUrl || null,
      raw_job_text: rawJobText,
      parsed_job_json: parsedJob,
      current_status: "saved" as ApplicationStatus,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createApplicationAction] DB insert error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  await logTimelineEvent(supabase, {
    application_id: data.id,
    user_id: user.id,
    event_type: "created",
  });

  try {
    const jdText = [
      parsedJob?.role_title,
      parsedJob?.company_name,
      parsedJob?.role_summary,
      rawJobText,
    ]
      .filter(Boolean)
      .join('\n');
    if (jdText && shouldUseSemanticEvidence()) {
      const jdEmbedding = await embedText(jdText);
      if (jdEmbedding) {
        await supabase
          .from("job_applications")
          .update({ jd_embedding: JSON.stringify(jdEmbedding) })
          .eq("id", data.id);
      }
    }
  } catch (e) {
    console.warn("[createApplicationAction] JD embedding failed:", e);
  }

  redirect(`/applications/${data.id}`);
}

export async function updateStatusAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  const statusResult = applicationStatusSchema.safeParse(formData.get("status"));
  if (!uuidSchema.safeParse(id).success || !statusResult.success) return;
  const status = statusResult.data as ApplicationStatus;

  const { data: current } = await supabase
    .from("job_applications")
    .select("current_status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  await supabase
    .from("job_applications")
    .update({ current_status: status })
    .eq("id", id)
    .eq("user_id", user.id);

  if (current) {
    await logTimelineEvent(supabase, {
      application_id: id,
      user_id: user.id,
      event_type: "status_changed",
      old_value: current.current_status,
      new_value: status,
    });
  }

  revalidatePath(`/applications/${id}`);
  revalidatePath("/tracker");
  revalidatePath("/dashboard");
}

export async function updateNotesAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("application_id") || "");
  const notes = cleanText(formData.get("notes"), MAX_NOTES_LENGTH);
  if (!uuidSchema.safeParse(id).success) return;

  await supabase
    .from("job_applications")
    .update({ notes })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath(`/applications/${id}`);
}

export async function deleteApplicationAction(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!uuidSchema.safeParse(id).success) return;

  await supabase
    .from("job_applications")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  redirect("/applications");
}
