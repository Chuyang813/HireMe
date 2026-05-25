const EMBEDDING_MODEL = 'text-embedding-004';

export function shouldUseSemanticEvidence(): boolean {
  return (
    process.env.ENABLE_SEMANTIC_EVIDENCE !== "false" &&
    Boolean(process.env.GEMINI_API_KEY)
  );
}

export async function embedText(text: string): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1/models/${EMBEDDING_MODEL}:embedContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text: text.slice(0, 8000) }] },
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Embedding API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.embedding.values as number[];
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
