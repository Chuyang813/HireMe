import Anthropic from "@anthropic-ai/sdk";

// Backup provider kept intentionally. The active provider is Gemini in
// provider.ts, but these helpers make it easy to switch back if needed.
export const ANTHROPIC_DEFAULT_MODEL =
  process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const ANTHROPIC_PROMPT_VERSION = "1.0";

const AI_TIMEOUT_MS = 60_000;
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

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to your .env.local to enable Claude backup features.",
    );
  }
  cached = new Anthropic({ apiKey });
  return cached;
}

export function extractAnthropicJson<T = unknown>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenced ? fenced[1] : text).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`No JSON object found in model output. Raw: ${candidate.slice(0, 200)}`);
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
  model = ANTHROPIC_DEFAULT_MODEL,
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
  try {
    const client = getAnthropic();
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI request timed out after 60s.")), AI_TIMEOUT_MS),
      ),
    ]);
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    try {
      return JSON.parse(text) as T;
    } catch {
      return extractAnthropicJson<T>(text);
    }
  } catch (err) {
    console.error("[claudeJson] Anthropic error:", err);
    throw err;
  }
}

export async function claudeText({
  system,
  messages,
  model = ANTHROPIC_DEFAULT_MODEL,
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
  try {
    const client = getAnthropic();
    const response = await Promise.race([
      client.messages.create({
        model,
        max_tokens: maxTokens,
        system,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("AI request timed out after 60s.")), AI_TIMEOUT_MS),
      ),
    ]);
    return response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
  } catch (err) {
    console.error("[claudeText] Anthropic error:", err);
    throw err;
  }
}
