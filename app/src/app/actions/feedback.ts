"use server";

import { requireUser } from "@/lib/auth/current-user";
import { uuidSchema } from "@/lib/security/limits";

export async function submitDocumentFeedback(
  documentId: string,
  feedbackType: string,
  rating: 1 | -1,
): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireUser();

  if (!uuidSchema.safeParse(documentId).success) {
    return { error: "Invalid document ID." };
  }

  const { error } = await supabase.from("document_feedback").upsert(
    {
      user_id: user.id,
      document_id: documentId,
      feedback_type: feedbackType,
      rating,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,document_id,feedback_type" },
  );

  if (error) {
    console.error("[submitDocumentFeedback] Error:", error.message);
    return { error: "Failed to save feedback." };
  }

  return { ok: true };
}

export async function getUserFeedback(
  documentId: string,
  feedbackType: string,
): Promise<{ rating: 1 | -1 | null }> {
  if (!uuidSchema.safeParse(documentId).success) return { rating: null };

  const { supabase, user } = await requireUser();

  const { data } = await supabase
    .from("document_feedback")
    .select("rating")
    .eq("user_id", user.id)
    .eq("document_id", documentId)
    .eq("feedback_type", feedbackType)
    .maybeSingle();

  return { rating: (data?.rating as 1 | -1 | null) ?? null };
}
