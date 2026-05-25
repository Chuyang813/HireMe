const DEEPSEEK_EMBEDDING_MODEL =
  process.env.DEEPSEEK_EMBEDDING_MODEL || "deepseek-embedding";
const DEEPSEEK_CHAT_EMBEDDING_FALLBACK_MODEL =
  process.env.DEEPSEEK_CHAT_EMBEDDING_FALLBACK_MODEL || "deepseek-v4-flash";
const DEEPSEEK_EMBEDDING_DIMENSIONS = 1536;
const DEEPSEEK_EMBEDDINGS_URL =
  process.env.DEEPSEEK_EMBEDDINGS_URL || "https://api.deepseek.com/embeddings";
const DEEPSEEK_API_BASE = process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com";
const DEEPSEEK_EMBEDDING_COOLDOWN_MS = 10 * 60 * 1000;

let deepSeekEmbeddingDisabledUntil = 0;

export function shouldUseSemanticEvidence(): boolean {
  return (
    process.env.ENABLE_SEMANTIC_EVIDENCE !== "false" &&
    Boolean(process.env.DEEPSEEK_API_KEY)
  );
}

function getDeepSeekApiKey(): string {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is not set. Add it to your .env.local to enable semantic evidence embeddings.",
    );
  }
  return apiKey;
}

export async function embedText(text: string): Promise<number[]> {
  if (Date.now() < deepSeekEmbeddingDisabledUntil) {
    return embedTextWithDeepSeekSemanticHash(text);
  }

  const res = await fetch(DEEPSEEK_EMBEDDINGS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getDeepSeekApiKey()}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_EMBEDDING_MODEL,
      input: text.slice(0, 8000),
      encoding_format: 'float',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    deepSeekEmbeddingDisabledUntil =
      Date.now() + DEEPSEEK_EMBEDDING_COOLDOWN_MS;
    console.warn(
      `[embedText] DeepSeek embedding endpoint failed (${res.status}); using DeepSeek chat-derived vector fallback.`,
    );
    return embedTextWithDeepSeekSemanticHash(text, err);
  }
  const data = await res.json();
  const embedding = data.data?.[0]?.embedding;
  if (
    !Array.isArray(embedding) ||
    embedding.length !== DEEPSEEK_EMBEDDING_DIMENSIONS
  ) {
    throw new Error(
      `DeepSeek Embedding returned ${Array.isArray(embedding) ? embedding.length : "no"} dimensions; expected ${DEEPSEEK_EMBEDDING_DIMENSIONS}.`,
    );
  }

  return embedding as number[];
}

async function embedTextWithDeepSeekSemanticHash(
  text: string,
  previousError?: string,
): Promise<number[]> {
  const res = await fetch(`${DEEPSEEK_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getDeepSeekApiKey()}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_CHAT_EMBEDDING_FALLBACK_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Extract compact semantic search terms from the text. Return only JSON with keys: topics, skills, actions, entities. Each value is an array of short lowercase strings.",
        },
        {
          role: "user",
          content: text.slice(0, 8000),
        },
      ],
      max_tokens: 700,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
    }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    throw new Error(
      `DeepSeek semantic vector fallback error ${res.status}: ${bodyText || previousError || ""}`,
    );
  }

  let signatureText = text;
  try {
    const data = JSON.parse(bodyText);
    const content = data.choices?.[0]?.message?.content ?? "{}";
    const signature = JSON.parse(content) as Record<string, unknown>;
    signatureText = Object.values(signature)
      .flatMap((value) => (Array.isArray(value) ? value : [value]))
      .filter((value): value is string => typeof value === "string")
      .join(" ");
  } catch {
    signatureText = bodyText || text;
  }

  return textToNormalizedVector(signatureText || text);
}

function textToNormalizedVector(text: string): number[] {
  const vector = Array(DEEPSEEK_EMBEDDING_DIMENSIONS).fill(0) as number[];
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9+.#-]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);

  for (const token of tokens) {
    const hash = hashString(token);
    const index = Math.abs(hash) % DEEPSEEK_EMBEDDING_DIMENSIONS;
    vector[index] += hash < 0 ? -1 : 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;
  return vector.map((value) => value / norm);
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function splitIntoSections(text: string): string[] {
  // Split on blank lines, keeping chunks of 200-800 chars
  const paragraphs = text.split(/\n{2,}/);
  const sections: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if ((current + para).length > 800 && current.length > 0) {
      sections.push(current.trim());
      current = para;
    } else {
      current += (current ? '\n\n' : '') + para;
    }
  }
  if (current.trim()) sections.push(current.trim());
  return sections.filter(s => s.length > 20);
}
