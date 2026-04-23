import { GoogleGenerativeAI } from "@google/generative-ai";

export const DEFAULT_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
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

let cached: GoogleGenerativeAI | null = null;

export function getGemini(): GoogleGenerativeAI {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local to enable AI features.",
    );
  }
  cached = new GoogleGenerativeAI(apiKey);
  return cached;
}

// Tolerant JSON extractor — handles ```json fences and extra prose.
export function extractJson<T = unknown>(text: string): T {
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

  const client = getGemini();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: system,
  });

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const timer = setTimeout(() => {
    throw new Error("AI request timed out after 30s.");
  }, AI_TIMEOUT_MS);

  try {
    const result = await genModel.generateContent({
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
      },
    });
    const text = result.response.text();
    console.log("[claudeJson] raw response length:", text.length);
    try {
      return JSON.parse(text) as T;
    } catch {
      return extractJson<T>(text);
    }
  } catch (err) {
    console.error("[claudeJson] Gemini error:", err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
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

  const client = getGemini();
  const genModel = client.getGenerativeModel({
    model,
    systemInstruction: system,
  });

  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? ("model" as const) : ("user" as const),
    parts: [{ text: m.content }],
  }));

  const timer = setTimeout(() => {
    throw new Error("AI request timed out after 30s.");
  }, AI_TIMEOUT_MS);

  try {
    const result = await genModel.generateContent({
      contents,
      generationConfig: { maxOutputTokens: maxTokens },
    });
    return result.response.text().trim();
  } catch (err) {
    console.error("[claudeText] Gemini error:", err);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
