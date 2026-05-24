"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { extractTextFromUpload } from "@/lib/parsers/resume-text";
import { parseResume } from "@/lib/ai/resume-parser";
import { embedText } from "@/lib/ai/embeddings";
import { cleanSingleLine, MAX_TITLE_LENGTH, uuidSchema } from "@/lib/security/limits";
import { sanitizePreviewHtml } from "@/lib/security/html";
import { checkRateLimit } from "@/lib/security/rate-limit";

export type UploadState = { error?: string; ok?: boolean } | undefined;

export async function uploadResumeAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const { supabase, user } = await requireUser();

  const title = cleanSingleLine(formData.get("title"), MAX_TITLE_LENGTH) || "Base resume";
  const makeDefault = formData.get("isDefault") === "on";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please select a PDF, DOCX, or TXT file." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File must be 10 MB or smaller." };
  }
  if (!isAllowedResumeUpload(file)) {
    return { error: "Please upload a PDF, DOCX, or TXT file." };
  }

  const limit = checkRateLimit(`resume-upload:${user.id}`, { max: 12, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many resume uploads. Try again in ${limit.retryAfterSec}s.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let rawText: string;
  let sourceType: "pdf" | "docx" | "txt";
  try {
    const extracted = await extractTextFromUpload(bytes, file.type, file.name);
    rawText = extracted.rawText;
    sourceType = extracted.sourceType;
  } catch (e) {
    console.error("[uploadResumeAction] File extraction error:", e);
    return {
      error:
        e instanceof Error
          ? e.message
          : "Failed to read the file. Please try a different format.",
    };
  }

  if (!rawText.trim()) {
    return { error: "Could not extract any text from this file." };
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${user.id}/${Date.now()}_${safeName}`;
  const upload = await supabase.storage
    .from("resumes")
    .upload(storagePath, bytes, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (upload.error) {
    console.error("[uploadResumeAction] Storage upload error:", upload.error);
    return { error: "Upload failed. Please try again." };
  }

  let parsed = null;
  try {
    parsed = await parseResume(rawText);
  } catch {
    // parse is best-effort; keep raw text even if structuring fails.
  }

  if (makeDefault) {
    await supabase
      .from("base_resumes")
      .update({ is_default: false })
      .eq("user_id", user.id)
      .eq("is_default", true);
  }

  const { data: insertedResume, error } = await supabase
    .from("base_resumes")
    .insert({
      user_id: user.id,
      title,
      source_file_path: storagePath,
      source_file_type: sourceType,
      raw_text: rawText,
      parsed_resume_json: parsed,
      is_default: makeDefault,
    })
    .select("id")
    .single();
  if (error || !insertedResume) {
    console.error("[uploadResumeAction] DB insert error:", error);
    return { error: "Failed to save resume. Please try again." };
  }

  try {
    const embedding = await embedText(rawText);
    await supabase
      .from("base_resumes")
      .update({ embedding: JSON.stringify(embedding) })
      .eq("id", insertedResume.id);
  } catch (e) {
    console.warn("[uploadResumeAction] Embedding failed, continuing without:", e);
  }

  revalidatePath("/resumes");
  redirect("/resumes");
}

export async function deleteResumeAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!uuidSchema.safeParse(id).success) return;
  const { data } = await supabase
    .from("base_resumes")
    .select("source_file_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (data?.source_file_path) {
    await supabase.storage.from("resumes").remove([data.source_file_path]);
  }
  await supabase.from("base_resumes").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/resumes");
}

export type PreviewResult =
  | { type: "pdf"; url: string }
  | { type: "docx"; html: string }
  | { type: "txt"; text: string }
  | { error: string };

export async function getResumePreviewAction(id: string): Promise<PreviewResult> {
  const { supabase, user } = await requireUser();
  if (!uuidSchema.safeParse(id).success) {
    return { error: "Resume not found." };
  }
  const { data } = await supabase
    .from("base_resumes")
    .select("source_file_path, source_file_type, raw_text")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!data) return { error: "Resume not found." };

  if (data.source_file_type === "txt" || !data.source_file_path) {
    return { type: "txt", text: data.raw_text ?? "" };
  }

  const { data: signedData, error: signedError } = await supabase.storage
    .from("resumes")
    .createSignedUrl(data.source_file_path, 300);

  if (signedError || !signedData?.signedUrl) {
    return { error: "Could not generate preview link." };
  }

  if (data.source_file_type === "pdf") {
    return { type: "pdf", url: signedData.signedUrl };
  }

  if (data.source_file_type === "docx") {
    try {
      const res = await supabase.storage.from("resumes").download(data.source_file_path);
      if (res.error || !res.data) return { error: "Could not download file." };
      const mammoth = await import("mammoth");
      const arrayBuffer = await res.data.arrayBuffer();
      const result = await mammoth.convertToHtml({ buffer: Buffer.from(arrayBuffer) });
      return { type: "docx", html: sanitizePreviewHtml(result.value) };
    } catch {
      return { error: "Could not render DOCX preview." };
    }
  }

  return { error: "Unsupported file type." };
}

export async function setDefaultResumeAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!uuidSchema.safeParse(id).success) return;
  await supabase
    .from("base_resumes")
    .update({ is_default: false })
    .eq("user_id", user.id)
    .eq("is_default", true);
  await supabase
    .from("base_resumes")
    .update({ is_default: true })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/resumes");
}

function isAllowedResumeUpload(file: File) {
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
