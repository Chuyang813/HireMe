"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { parseJobPosting } from "@/lib/ai/job-parser";
import { logTimelineEvent } from "@/lib/db/timeline";
import type { ApplicationStatus, ParsedJob } from "@/lib/db/types";

export type CreateApplicationState = { error?: string } | undefined;
export type AnalyzeJobState = { parsed?: ParsedJob; error?: string } | undefined;

export async function analyzeJobAction(
  _prev: AnalyzeJobState,
  formData: FormData,
): Promise<AnalyzeJobState> {
  const rawJobText = String(formData.get("raw_job_text") || "").trim();
  if (!rawJobText) return { error: "Please paste the job description." };
  try {
    const parsed = await parseJobPosting(rawJobText);
    return { parsed };
  } catch (e) {
    console.error("[analyzeJobAction]", e);
    return { error: "AI analysis failed. Please try again." };
  }
}

export async function createApplicationAction(
  _prev: CreateApplicationState,
  formData: FormData,
): Promise<CreateApplicationState> {
  const { supabase, user } = await requireUser();

  const companyName = String(formData.get("company_name") || "").trim();
  const roleTitle = String(formData.get("role_title") || "").trim();
  const jobUrl = String(formData.get("job_url") || "").trim();
  const rawJobText = String(formData.get("raw_job_text") || "").trim();
  const parsedJobRaw = String(formData.get("parsed_job_json") || "").trim();

  if (!rawJobText) return { error: "Please paste the job description." };

  if (jobUrl && !/^https?:\/\//i.test(jobUrl)) {
    return { error: "Job URL must start with http:// or https://." };
  }

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
  const status = String(formData.get("status") || "") as ApplicationStatus;
  if (!id || !status) return;

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
  const notes = String(formData.get("notes") || "");
  if (!id) return;

  await supabase
    .from("job_applications")
    .update({ notes })
    .eq("id", id)
    .eq("user_id", user.id);

  revalidatePath(`/applications/${id}`);
}
