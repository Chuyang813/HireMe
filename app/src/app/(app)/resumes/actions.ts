"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { extractTextFromUpload } from "@/lib/parsers/resume-text";
import { parseResume } from "@/lib/ai/resume-parser";

export type UploadState = { error?: string; ok?: boolean } | undefined;

export async function uploadResumeAction(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const { supabase, user } = await requireUser();

  const title = String(formData.get("title") || "").trim() || "Base resume";
  const makeDefault = formData.get("isDefault") === "on";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please select a PDF, DOCX, or TXT file." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { error: "File must be 10 MB or smaller." };
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

  const { error } = await supabase.from("base_resumes").insert({
    user_id: user.id,
    title,
    source_file_path: storagePath,
    source_file_type: sourceType,
    raw_text: rawText,
    parsed_resume_json: parsed,
    is_default: makeDefault,
  });
  if (error) {
    console.error("[uploadResumeAction] DB insert error:", error);
    return { error: "Failed to save resume. Please try again." };
  }

  revalidatePath("/resumes");
  redirect("/resumes");
}

export async function deleteResumeAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) return;
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
      return { type: "docx", html: result.value };
    } catch {
      return { error: "Could not render DOCX preview." };
    }
  }

  return { error: "Unsupported file type." };
}

export async function setDefaultResumeAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id") || "");
  if (!id) return;
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
