import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimelineEventType } from "./types";

export async function logTimelineEvent(
  supabase: SupabaseClient,
  params: {
    application_id: string;
    user_id: string;
    event_type: TimelineEventType;
    old_value?: string | null;
    new_value?: string | null;
    note?: string | null;
  },
) {
  await supabase.from("application_timeline_events").insert({
    application_id: params.application_id,
    user_id: params.user_id,
    event_type: params.event_type,
    old_value: params.old_value ?? null,
    new_value: params.new_value ?? null,
    note: params.note ?? null,
  });
}
