import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentType } from "@/lib/db/types";

export type AiEventInput = {
  user_id: string;
  application_id?: string | null;
  event_type: string;
  provider?: string;
  model?: string;
  prompt_type?: string;
  prompt_version?: string;
  document_type?: DocumentType;
  latency_ms?: number;
  success: boolean;
  error_message?: string;
  metadata_json?: Record<string, unknown>;
};

export async function logAiEvent(
  supabase: SupabaseClient,
  event: AiEventInput,
) {
  const { error } = await supabase.from("ai_events").insert({
    ...event,
    error_message: event.error_message?.slice(0, 500) ?? null,
    metadata_json: event.metadata_json ?? {},
  });

  if (error) {
    console.error("[logAiEvent] Failed to record AI event:", error.message);
  }
}
