import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your .env.local to enable AI features.",
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

// Extract a JSON object from a Claude response string.
// Tolerant of ```json code fences and extra prose.
export function extractJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output.");
  }
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}

export type ClaudeTextMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function claudeJson<T>({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 4096,
}: {
  system: string;
  messages: ClaudeTextMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  return extractJson<T>(text);
}

export async function claudeText({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 4096,
}: {
  system: string;
  messages: ClaudeTextMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
