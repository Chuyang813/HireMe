"use server";

import { requireUser } from "@/lib/auth/current-user";

export interface AiEventStat {
  event_type: string;
  model: string | null;
  prompt_type: string | null;
  success: boolean;
  count: number;
  avg_latency_ms: number | null;
}

export interface AiEventRow {
  id: string;
  created_at: string;
  event_type: string;
  provider: string | null;
  model: string | null;
  prompt_type: string | null;
  prompt_version: string | null;
  document_type: string | null;
  latency_ms: number | null;
  success: boolean;
  error_message: string | null;
}

export interface AiEventStats {
  totalEvents: number;
  successRate: number;
  avgLatencyMs: number | null;
  errorCount: number;
  byModel: Array<{ model: string | null; count: number; successRate: number }>;
  byPromptType: Array<{ prompt_type: string | null; count: number; avgLatencyMs: number | null }>;
  recent: AiEventRow[];
}

export async function getAiEventStats(): Promise<AiEventStats> {
  const { supabase } = await requireUser();

  const { data: rows } = await supabase
    .from("ai_events")
    .select(
      "id, created_at, event_type, provider, model, prompt_type, prompt_version, document_type, latency_ms, success, error_message",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const events = (rows ?? []) as AiEventRow[];

  const totalEvents = events.length;
  const successCount = events.filter((e) => e.success).length;
  const errorCount = events.filter((e) => !e.success).length;
  const successRate = totalEvents > 0 ? Math.round((successCount / totalEvents) * 100) : 0;

  const latencies = events.filter((e) => e.latency_ms != null).map((e) => e.latency_ms as number);
  const avgLatencyMs =
    latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null;

  const modelMap = new Map<string | null, { count: number; success: number }>();
  for (const e of events) {
    const key = e.model;
    const cur = modelMap.get(key) ?? { count: 0, success: 0 };
    cur.count++;
    if (e.success) cur.success++;
    modelMap.set(key, cur);
  }
  const byModel = Array.from(modelMap.entries()).map(([model, v]) => ({
    model,
    count: v.count,
    successRate: v.count > 0 ? Math.round((v.success / v.count) * 100) : 0,
  }));

  const ptMap = new Map<string | null, { count: number; latencies: number[] }>();
  for (const e of events) {
    const key = e.prompt_type;
    const cur = ptMap.get(key) ?? { count: 0, latencies: [] };
    cur.count++;
    if (e.latency_ms != null) cur.latencies.push(e.latency_ms);
    ptMap.set(key, cur);
  }
  const byPromptType = Array.from(ptMap.entries()).map(([prompt_type, v]) => ({
    prompt_type,
    count: v.count,
    avgLatencyMs:
      v.latencies.length > 0
        ? Math.round(v.latencies.reduce((a, b) => a + b, 0) / v.latencies.length)
        : null,
  }));

  return { totalEvents, successRate, avgLatencyMs, errorCount, byModel, byPromptType, recent: events };
}
