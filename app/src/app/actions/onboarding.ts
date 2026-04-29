"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { extractTextFromUpload } from "@/lib/parsers/resume-text";
import { parseResume } from "@/lib/ai/resume-parser";

// ---------------------------------------------------------------------------
// Save basic profile info (step 1)
// ---------------------------------------------------------------------------

export type SaveProfileState = { error?: string; ok?: boolean } | undefined;

export async function saveProfileStep1Action(
  _prev: SaveProfileState,
  formData: FormData,
): Promise<SaveProfileState> {
  const { supabase, user } = await requireUser();

  const full_name = String(formData.get("full_name") || "").trim();
  const target_role = String(formData.get("target_role") || "").trim();
  const years_experience_raw = Number(formData.get("years_experience") || 0);
  const years_experience = isNaN(years_experience_raw) ? null : years_experience_raw;

  if (!full_name) return { error: "Full name is required." };
  if (!target_role) return { error: "Target role is required." };

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name,
      target_role,
      years_experience,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[saveProfileStep1Action] DB error:", error);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath("/onboarding");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Upload resume during onboarding (step 2) — same as uploadResumeAction
// but returns state instead of redirecting
// ---------------------------------------------------------------------------

export type UploadOnboardingResumeState =
  | { ok: true; error?: never }
  | { error: string; ok?: never }
  | undefined;

export async function uploadOnboardingResumeAction(
  _prev: UploadOnboardingResumeState,
  formData: FormData,
): Promise<UploadOnboardingResumeState> {
  const { supabase, user } = await requireUser();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Please select a PDF, DOCX, or TXT file." };
  if (file.size > 10 * 1024 * 1024)
    return { error: "File must be 10 MB or smaller." };

  const bytes = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  let sourceType: "pdf" | "docx" | "txt";
  try {
    const extracted = await extractTextFromUpload(bytes, file.type, file.name);
    rawText = extracted.rawText;
    sourceType = extracted.sourceType;
  } catch (e) {
    console.error("[uploadOnboardingResumeAction] File extraction error:", e);
    return { error: "Failed to read the file. Please try a different format." };
  }

  if (!rawText.trim()) return { error: "Could not extract any text from this file." };

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${user.id}/${Date.now()}_${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("resumes")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) {
    console.error("[uploadOnboardingResumeAction] Storage error:", uploadError);
    return { error: "Upload failed. Please try again." };
  }

  let parsed = null;
  try {
    parsed = await parseResume(rawText);
  } catch {
    // best-effort parse
  }

  // set as default, clearing any existing default
  await supabase
    .from("base_resumes")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true);

  const { error: insertError } = await supabase.from("base_resumes").insert({
    user_id: user.id,
    title: "Base resume",
    source_file_path: storagePath,
    source_file_type: sourceType,
    raw_text: rawText,
    parsed_resume_json: parsed,
    is_default: true,
  });

  if (insertError) {
    console.error("[uploadOnboardingResumeAction] DB insert error:", insertError);
    return { error: "Failed to save resume. Please try again." };
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    });

  if (profileError) {
    console.error("[uploadOnboardingResumeAction] Profile update error:", profileError);
    return { error: "Resume saved, but setup could not be completed. Please try again." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/resumes");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Save target industries/companies + complete onboarding (step 3)
// ---------------------------------------------------------------------------

export async function completeOnboardingAction(
  _prev: SaveProfileState,
  formData: FormData,
): Promise<SaveProfileState> {
  const { supabase, user } = await requireUser();

  const industries_raw = String(formData.get("target_industries") || "");
  const companies_raw = String(formData.get("target_companies") || "");

  const target_industries = industries_raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const target_companies = companies_raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      target_industries,
      target_companies,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("[completeOnboardingAction] DB error:", error);
    return { error: "Something went wrong. Please try again." };
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
