const DEEPSEEK_EMBEDDING_MODEL =
  process.env.DEEPSEEK_EMBEDDING_MODEL || "deepseek-embedding";
const DEEPSEEK_EMBEDDING_DIMENSIONS = 1536;
const DEEPSEEK_EMBEDDINGS_URL =
  process.env.DEEPSEEK_EMBEDDINGS_URL || "https://api.deepseek.com/embeddings";

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
