export const AI_PROVIDER = "gemini";
export const DEFAULT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
export const PROMPT_VERSION = "2.0";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const AI_TIMEOUT_MS = 60_000;

export type AiTextMessage = {
  role: "user" | "assistant";
  content: string;
};

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type GeminiCandidate = {
  content?: {
    parts?: Array<{ text?: string }>;
  };
  finishReason?: string;
};

type GeminiResponse = {
  candidates?: GeminiCandidate[];
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

function getGeminiApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to your .env.local to enable AI features.",
    );
  }
  return apiKey;
}

function toGeminiRole(role: AiTextMessage["role"]) {
  return role === "assistant" ? "model" : "user";
}

function extractText(response: GeminiResponse): string {
  if (response.error) {
    throw new Error(response.error.message ?? "Gemini API request failed.");
  }

  const text =
    response.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim() ?? "";

  if (!text) {
    const reason = response.candidates?.[0]?.finishReason;
    throw new Error(
      reason ? `Gemini returned no text. Finish reason: ${reason}.` : "Gemini returned no text.",
    );
  }

  return text;
}

async function generateGemini({
  system,
  messages,
  parts,
  model = DEFAULT_MODEL,
  maxTokens = 4096,
  responseMimeType = "text/plain",
}: {
  system?: string;
  messages?: AiTextMessage[];
  parts?: GeminiPart[];
  model?: string;
  maxTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
}): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const contents = parts
      ? [{ role: "user", parts }]
      : (messages ?? []).map((message) => ({
          role: toGeminiRole(message.role),
          parts: [{ text: message.content }],
        }));

    const res = await fetch(
      `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": getGeminiApiKey(),
        },
        body: JSON.stringify({
          systemInstruction: system
            ? { parts: [{ text: system }] }
            : undefined,
          contents,
          generationConfig: {
            maxOutputTokens: maxTokens,
            responseMimeType,
          },
        }),
        signal: controller.signal,
      },
    );

    const json = (await res.json().catch(() => ({}))) as GeminiResponse;
    if (!res.ok) {
      throw new Error(
        json.error?.message ?? `Gemini API request failed with status ${res.status}.`,
      );
    }

    return extractText(json);
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("AI request timed out after 60s.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

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

export async function aiJson<T>({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 4096,
}: {
  system: string;
  messages: AiTextMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<T> {
  const text = await generateGemini({
    system,
    messages,
    model,
    maxTokens,
    responseMimeType: "application/json",
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    return extractJson<T>(text);
  }
}

export async function aiText({
  system,
  messages,
  model = DEFAULT_MODEL,
  maxTokens = 4096,
}: {
  system: string;
  messages: AiTextMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  return generateGemini({
    system,
    messages,
    model,
    maxTokens,
    responseMimeType: "text/plain",
  });
}

export async function aiExtractPdfText(buffer: Buffer): Promise<string> {
  return generateGemini({
    parts: [
      {
        inlineData: {
          mimeType: "application/pdf",
          data: buffer.toString("base64"),
        },
      },
      {
        text:
          "Extract the full plain text of this document, preserving section order and line breaks. Output only the text, no commentary.",
      },
    ],
    maxTokens: 4096,
    responseMimeType: "text/plain",
  });
}
