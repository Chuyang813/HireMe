/**
 * Embedding utilities
 * Provider: Google Gemini text-embedding-004 (v1 endpoint, free tier)
 * DeepSeek is used for chat/generation only — it has no embedding API.
 */

async function embedTextWithModel(text: string, model: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/${model}:embedContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: { parts: [{ text: text.slice(0, 8000) }] },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.embedding.values as number[];
}

export async function embedText(text: string): Promise<number[]> {
  try {
    return await embedTextWithModel(text, 'text-embedding-004');
  } catch (e) {
    console.warn('[embedText] text-embedding-004 failed, trying embedding-001:', e);
    return await embedTextWithModel(text, 'embedding-001');
  }
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

export function shouldUseSemanticEvidence(): boolean {
  return !!process.env.GEMINI_API_KEY && process.env.ENABLE_SEMANTIC_EVIDENCE !== 'false';
}
