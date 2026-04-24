export const AI_PROVIDER = "gemini";
export const DEFAULT_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
export const PROMPT_VERSION = "2.0";

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const AI_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUS = new Set([503]);
const DEFAULT_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemma-3-27b-it",
  "gemma-3-12b-it",
  "gemma-3-4b-it",
];

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

function isGemmaModel(model: string): boolean {
  return model.startsWith("gemma-");
}

function getModelChain(primary: string): string[] {
  const fallbackModels =
    process.env.GEMINI_FALLBACK_MODELS?.split(",")
      .map((model) => model.trim())
      .filter(Boolean) ?? DEFAULT_FALLBACK_MODELS;

  return [primary, ...fallbackModels].filter(
    (model, index, models) => models.indexOf(model) === index,
  );
}

function withSystemInUserMessage(
  system: string,
  messages: AiTextMessage[],
): AiTextMessage[] {
  const [first, ...rest] = messages;
  const systemBlock = `Instructions:\n${system}`;

  if (!first) {
    return [{ role: "user", content: systemBlock }];
  }

  return [
    {
      ...first,
      content: `${systemBlock}\n\nUser request:\n${first.content}`,
    },
    ...rest,
  ];
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
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
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
          { cause: res.status },
        );
      }

      return extractText(json);
    } catch (err) {
      lastError =
        err instanceof Error
          ? err
          : new Error("Gemini API request failed.");
      if (lastError.name === "AbortError") {
        lastError = new Error("AI request timed out after 60s.");
      }

      const status =
        typeof lastError.cause === "number" ? lastError.cause : null;
      if (!status || !RETRYABLE_STATUS.has(status) || attempt === 3) {
        throw lastError;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError ?? new Error("Gemini API request failed.");
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
  let lastError: Error | null = null;

  for (const candidateModel of getModelChain(model)) {
    try {
      const isGemma = isGemmaModel(candidateModel);
      const jsonSystem = `${system}\n\nReturn only valid JSON. Do not use markdown or prose.`;
      const text = await generateGemini({
        system: isGemma ? undefined : system,
        messages: isGemma ? withSystemInUserMessage(jsonSystem, messages) : messages,
        model: candidateModel,
        maxTokens,
        responseMimeType: isGemma ? "text/plain" : "application/json",
      });

      try {
        return JSON.parse(text) as T;
      } catch {
        return extractJson<T>(text);
      }
    } catch (err) {
      lastError =
        err instanceof Error
          ? err
          : new Error("Gemini API request failed.");
    }
  }

  throw lastError ?? new Error("Gemini API request failed.");
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
  let lastError: Error | null = null;

  for (const candidateModel of getModelChain(model)) {
    try {
      const isGemma = isGemmaModel(candidateModel);
      return await generateGemini({
        system: isGemma ? undefined : system,
        messages: isGemma ? withSystemInUserMessage(system, messages) : messages,
        model: candidateModel,
        maxTokens,
        responseMimeType: "text/plain",
      });
    } catch (err) {
      lastError =
        err instanceof Error
          ? err
          : new Error("Gemini API request failed.");
    }
  }

  throw lastError ?? new Error("Gemini API request failed.");
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
