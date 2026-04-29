export const PROMPT_VERSION = "2.1";

const GLM_API_BASE = "https://api.z.ai/api/paas/v4";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const AI_TIMEOUT_MS = 60_000;
const RETRYABLE_STATUS = new Set([503]);

const DEFAULT_GLM_MODEL = process.env.GLM_MODEL || "glm-4.5-flash";
const DEFAULT_GLM_FALLBACK_MODELS = ["glm-4.7-flash"];
const DEFAULT_GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite-preview";
const DEFAULT_GEMINI_FALLBACK_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemma-3-27b-it",
  "gemma-3-12b-it",
  "gemma-3-4b-it",
];

export const AI_PROVIDER = getGlmApiKeyOptional() ? "glm" : "gemini";
export const DEFAULT_MODEL =
  AI_PROVIDER === "glm" ? DEFAULT_GLM_MODEL : DEFAULT_GEMINI_MODEL;

export type AiTextMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProviderName = "glm" | "gemini";

type ProviderModel = {
  provider: ProviderName;
  model: string;
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

type GlmResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
    finish_reason?: string;
  }>;
  error?: {
    code?: string | number;
    message?: string;
  };
};

function getGlmApiKeyOptional(): string | undefined {
  return process.env.GLM_API_KEY || process.env.ZAI_API_KEY;
}

function getGlmApiKey(): string {
  const apiKey = getGlmApiKeyOptional();
  if (!apiKey) {
    throw new Error(
      "GLM_API_KEY is not set. Add it to your .env.local to enable GLM features.",
    );
  }
  return apiKey;
}

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

function parseModelList(value: string | undefined, fallback: string[]): string[] {
  return (
    value
      ?.split(",")
      .map((model) => model.trim())
      .filter(Boolean) ?? fallback
  );
}

function uniqueModels(models: ProviderModel[]): ProviderModel[] {
  return models.filter(
    (candidate, index) =>
      models.findIndex(
        (model) =>
          model.provider === candidate.provider && model.model === candidate.model,
      ) === index,
  );
}

function getProviderChain(primary: string, preferredProvider: ProviderName): ProviderModel[] {
  const glmFallbackModels = parseModelList(
    process.env.GLM_FALLBACK_MODELS,
    DEFAULT_GLM_FALLBACK_MODELS,
  );
  const geminiFallbackModels =
    process.env.GEMINI_FALLBACK_MODELS?.split(",")
      .map((model) => model.trim())
      .filter(Boolean) ?? DEFAULT_GEMINI_FALLBACK_MODELS;

  const glmModels = [primary, ...glmFallbackModels].map((model) => ({
    provider: "glm" as const,
    model,
  }));
  const geminiModels = [DEFAULT_GEMINI_MODEL, ...geminiFallbackModels].map((model) => ({
    provider: "gemini" as const,
    model,
  }));

  const ordered = preferredProvider === "glm"
    ? [...glmModels, ...geminiModels]
    : [
        { provider: "gemini" as const, model: primary },
        ...geminiFallbackModels.map((model) => ({ provider: "gemini" as const, model })),
        { provider: "glm" as const, model: DEFAULT_GLM_MODEL },
        ...glmFallbackModels.map((model) => ({ provider: "glm" as const, model })),
      ];

  return uniqueModels(ordered).filter((candidate) =>
    candidate.provider === "glm" ? !!getGlmApiKeyOptional() : !!process.env.GEMINI_API_KEY,
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

function extractGlmText(response: GlmResponse): string {
  if (response.error) {
    throw new Error(response.error.message ?? "GLM API request failed.");
  }

  const text = response.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    const reason = response.choices?.[0]?.finish_reason;
    throw new Error(
      reason ? `GLM returned no text. Finish reason: ${reason}.` : "GLM returned no text.",
    );
  }

  return text;
}

async function generateGlm({
  system,
  messages,
  model = DEFAULT_GLM_MODEL,
  maxTokens = 4096,
  responseMimeType = "text/plain",
}: {
  system?: string;
  messages: AiTextMessage[];
  model?: string;
  maxTokens?: number;
  responseMimeType?: "text/plain" | "application/json";
}): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const res = await fetch(`${GLM_API_BASE}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getGlmApiKey()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            ...messages,
          ],
          max_tokens: maxTokens,
          thinking: {
            type: "disabled",
          },
          response_format:
            responseMimeType === "application/json"
              ? { type: "json_object" }
              : undefined,
        }),
        signal: controller.signal,
      });

      const json = (await res.json().catch(() => ({}))) as GlmResponse;
      if (!res.ok) {
        throw new Error(
          json.error?.message ?? `GLM API request failed with status ${res.status}.`,
          { cause: res.status },
        );
      }

      return extractGlmText(json);
    } catch (err) {
      lastError =
        err instanceof Error ? err : new Error("GLM API request failed.");
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

  throw lastError ?? new Error("GLM API request failed.");
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

  for (const candidate of getProviderChain(model, AI_PROVIDER as ProviderName)) {
    try {
      const isGemini = candidate.provider === "gemini";
      const isGemma = isGemini && isGemmaModel(candidate.model);
      const jsonSystem = `${system}\n\nReturn only valid JSON. Do not use markdown or prose.`;
      const text =
        candidate.provider === "glm"
          ? await generateGlm({
              system: jsonSystem,
              messages,
              model: candidate.model,
              maxTokens,
              responseMimeType: "application/json",
            })
          : await generateGemini({
              system: isGemma ? undefined : system,
              messages: isGemma ? withSystemInUserMessage(jsonSystem, messages) : messages,
              model: candidate.model,
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
          : new Error("AI provider request failed.");
      console.error(
        `[aiJson] ${candidate.provider}:${candidate.model} failed:`,
        lastError.message,
      );
    }
  }

  throw lastError ?? new Error("AI provider request failed.");
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

  for (const candidate of getProviderChain(model, AI_PROVIDER as ProviderName)) {
    try {
      if (candidate.provider === "glm") {
        return await generateGlm({
          system,
          messages,
          model: candidate.model,
          maxTokens,
          responseMimeType: "text/plain",
        });
      }

      const isGemma = isGemmaModel(candidate.model);
      return await generateGemini({
        system: isGemma ? undefined : system,
        messages: isGemma ? withSystemInUserMessage(system, messages) : messages,
        model: candidate.model,
        maxTokens,
        responseMimeType: "text/plain",
      });
    } catch (err) {
      lastError =
        err instanceof Error
          ? err
          : new Error("AI provider request failed.");
      console.error(
        `[aiText] ${candidate.provider}:${candidate.model} failed:`,
        lastError.message,
      );
    }
  }

  throw lastError ?? new Error("AI provider request failed.");
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
