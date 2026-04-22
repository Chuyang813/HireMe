import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const PROMPT_VERSION = "1.0";

const AI_TIMEOUT_MS = 30_000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1_000;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string): void {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    const minutesLeft = Math.ceil((entry.resetAt - now) / 60_000);
    throw new Error(
      `Rate limit reached. Try again in ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
    );
  }
  entry.count += 1;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 429 || status === 503) {
      await new Promise((res) => setTimeout(res, 2_000));
      return fn();
    }
    throw err;
  }
}

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
  userId,
}: {
  system: string;
  messages: ClaudeTextMessage[];
  model?: string;
  maxTokens?: number;
  userId?: string;
}): Promise<T> {
  if (userId) checkRateLimit(userId);
  const client = getAnthropic();
  const resp = await withRetry(() =>
    client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    ),
  );
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
  userId,
}: {
  system: string;
  messages: ClaudeTextMessage[];
  model?: string;
  maxTokens?: number;
  userId?: string;
}): Promise<string> {
  if (userId) checkRateLimit(userId);
  const client = getAnthropic();
  const resp = await withRetry(() =>
    client.messages.create(
      {
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      },
      { signal: AbortSignal.timeout(AI_TIMEOUT_MS) },
    ),
  );
  return resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
