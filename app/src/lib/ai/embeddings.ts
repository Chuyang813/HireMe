/**
 * Embedding utilities
 *
 * BM25 is the active scoring method — pure JS, no external API required.
 * embedText() is retained as a deprecated stub for call sites that write to
 * the DB embedding columns (applications.ts, resumes/actions.ts); those writes
 * are no-ops because embedText always returns null.
 */

// ---------------------------------------------------------------------------
// BM25 — k1=1.5, b=0.75 (Robertson–Sparck Jones standard defaults)
// ---------------------------------------------------------------------------

function tokenizeBM25(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.#-]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** BM25 relevance score between a query and a document. No external API needed. */
export function bm25Score(query: string, document: string): number {
  const k1 = 1.5;
  const b = 0.75;

  const queryTokens = tokenizeBM25(query);
  const docTokens = tokenizeBM25(document);
  const docLen = docTokens.length;
  if (docLen === 0 || queryTokens.length === 0) return 0;

  const tf = new Map<string, number>();
  for (const t of docTokens) tf.set(t, (tf.get(t) ?? 0) + 1);

  // Without a shared corpus, self-normalize: avgdl = docLen → (1-b+b*1) = 1
  let score = 0;
  for (const term of new Set(queryTokens)) {
    const termFreq = tf.get(term) ?? 0;
    if (termFreq === 0) continue;
    score += (termFreq * (k1 + 1)) / (termFreq + k1 * (1 - b + b));
  }
  return score;
}

// ---------------------------------------------------------------------------
// Legacy stubs — Gemini Embedding API is permanently unavailable
// ---------------------------------------------------------------------------

/** @deprecated Gemini Embedding API is permanently unavailable. Use bm25Score() instead. */
export async function embedText(_text: string): Promise<number[] | null> {
  return null;
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
  return true;
}
