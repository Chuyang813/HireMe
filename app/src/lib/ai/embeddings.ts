const DEEPSEEK_EMBEDDING_MODEL =
  process.env.DEEPSEEK_EMBEDDING_MODEL || "deepseek-embedding";
const GEMINI_EMBEDDING_MODEL = "text-embedding-004";
const DEEPSEEK_EMBEDDING_DIMENSIONS = 1536;
const DEEPSEEK_EMBEDDINGS_URL =
  process.env.DEEPSEEK_EMBEDDINGS_URL || "https://api.deepseek.com/embeddings";
const DEEPSEEK_EMBEDDING_COOLDOWN_MS = 10 * 60 * 1000;

let deepSeekEmbeddingDisabledUntil = 0;

export function shouldUseSemanticEvidence(): boolean {
  return (
    process.env.ENABLE_SEMANTIC_EVIDENCE !== "false" &&
    Boolean(process.env.DEEPSEEK_API_KEY || process.env.GEMINI_API_KEY)
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

async function embedTextWithDeepSeek(text: string): Promise<number[]> {
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
    throw new Error(`DeepSeek Embedding error ${res.status}: ${err}`);
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

async function embedTextWithGemini(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${GEMINI_EMBEDDING_MODEL}`,
      content: { parts: [{ text: text.slice(0, 8000) }] },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini Embedding error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const embedding = data.embedding?.values;
  if (!Array.isArray(embedding)) {
    throw new Error("Gemini Embedding returned no vector.");
  }

  return padEmbedding(embedding as number[]);
}

function padEmbedding(embedding: number[]): number[] {
  if (embedding.length === DEEPSEEK_EMBEDDING_DIMENSIONS) return embedding;
  if (embedding.length > DEEPSEEK_EMBEDDING_DIMENSIONS) {
    return embedding.slice(0, DEEPSEEK_EMBEDDING_DIMENSIONS);
  }
  return [
    ...embedding,
    ...Array(DEEPSEEK_EMBEDDING_DIMENSIONS - embedding.length).fill(0),
  ];
}

export async function embedText(text: string): Promise<number[]> {
  if (
    process.env.DEEPSEEK_API_KEY &&
    Date.now() >= deepSeekEmbeddingDisabledUntil
  ) {
    try {
      return await embedTextWithDeepSeek(text);
    } catch (error) {
      if (!process.env.GEMINI_API_KEY) throw error;
      deepSeekEmbeddingDisabledUntil =
        Date.now() + DEEPSEEK_EMBEDDING_COOLDOWN_MS;
      console.warn(
        "[embedText] DeepSeek embedding failed, using Gemini embedding padded to 1536 dimensions:",
        error,
      );
    }
  }

  return embedTextWithGemini(text);
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
