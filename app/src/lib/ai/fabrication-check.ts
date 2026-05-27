import { bm25Score } from "./embeddings";

export interface FabricationResult {
  score: number
  fabricatedClaims: Array<{
    claim: string
    reason: string
    severity: "high" | "medium" | "low"
  }>
  verifiedClaims: number
  totalClaims: number
}

const VERIFICATION_THRESHOLD = 0.1;

// ---------------------------------------------------------------------------
// Claim extraction — pull individual verifiable assertions out of generated
// resume markdown. Bullet points are the main unit of verifiable content.
// ---------------------------------------------------------------------------

interface RawClaim {
  text: string
  severity: "high" | "medium" | "low"
}

function extractVerifiableClaims(content: string): RawClaim[] {
  const claims: RawClaim[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith("---")) continue;

    const isBullet = /^[-•*]\s+/.test(line);
    if (!isBullet) continue;

    const text = line.replace(/^[-•*]\s+/, "").trim();
    if (text.length < 8) continue;

    // High severity: bullet contains a specific quantitative claim
    const hasQuantitative =
      /\d+(?:\.\d+)?%|\$[\d,.]+[kKmMbBtT]?|\b\d{1,3}(?:,\d{3})+\b|(?:increased|decreased|improved|reduced|grew|saved|generated|cut|boosted)\s[^.]*\d/i.test(
        text,
      );

    claims.push({ text, severity: hasQuantitative ? "high" : "medium" });
  }

  return claims;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function checkFabrication(
  generatedContent: string,
  sourceResume: string,
  _jobDescription: string,
): Promise<FabricationResult> {
  const claims = extractVerifiableClaims(generatedContent);

  if (claims.length === 0) {
    return { score: 100, fabricatedClaims: [], verifiedClaims: 0, totalClaims: 0 };
  }

  const fabricatedClaims: FabricationResult["fabricatedClaims"] = [];
  let verifiedCount = 0;

  for (const { text, severity } of claims) {
    const score = bm25Score(text, sourceResume);

    if (score < VERIFICATION_THRESHOLD) {
      fabricatedClaims.push({
        claim: text,
        reason:
          severity === "high"
            ? "Quantitative claim not found in source material"
            : "Not found in source resume",
        severity,
      });
    } else {
      verifiedCount++;
    }
  }

  const totalClaims = claims.length;
  const overallScore =
    totalClaims > 0 ? Math.round((verifiedCount / totalClaims) * 100) : 100;

  return {
    score: overallScore,
    fabricatedClaims,
    verifiedClaims: verifiedCount,
    totalClaims,
  };
}
