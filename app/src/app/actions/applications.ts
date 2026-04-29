"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { parseJobPosting } from "@/lib/ai/job-parser";
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

export type CreateApplicationState = { error?: string } | undefined;
export type AnalyzeJobState = { parsed?: ParsedJob; error?: string } | undefined;

export async function analyzeJobAction(
  _prev: AnalyzeJobState,
  formData: FormData,
): Promise<AnalyzeJobState> {
  const { supabase, user } = await requireUser();
  const { data: defaultResume } = await supabase
    .from("base_resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (!defaultResume) {
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

  // If no description but URL given, try to fetch the page content.
  if (!rawJobText && jobUrl) {
    try {
      const res = await fetch(jobUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HireMe/1.0)" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!/text\/html|text\/plain|application\/xhtml\+xml/i.test(contentType)) {
          return { error: "That URL does not look like a readable job posting." };
        }
        const html = await res.text();
        rawJobText = html
          .replace(/<script[\s\S]*?<\/script>/gi, "")
          .replace(/<style[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 12_000);
      }
    } catch {
      // fetch failed — fall through to error below
    }
    if (!rawJobText) {
      return {
        error:
          "Couldn't fetch that URL (job boards often block automated access). Please paste the job description directly.",
      };
    }
  }

  if (!rawJobText) return { error: "Please paste the job description." };
  try {
    const parsed = await parseJobPosting(rawJobText);
    return { parsed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[analyzeJobAction] parseJobPosting failed:", msg, e);
    if (msg.includes("GEMINI_API_KEY")) {
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

  const { data: defaultResume } = await supabase
    .from("base_resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (!defaultResume) {
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
      base_resume_id: defaultResume.id,
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
