export interface ATSResult {
  overall: number
  breakdown: {
    keywordMatch: number
    formatting: number
    readability: number
    lengthScore: number
  }
  suggestions: string[]
  matchedKeywords: string[]
  missingKeywords: string[]
}

// ---------------------------------------------------------------------------
// Stopwords
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "and", "or", "the", "a", "an", "in", "at", "to", "for", "of", "with",
  "on", "by", "from", "as", "is", "are", "will", "be", "this", "that",
  "have", "has", "had", "you", "your", "we", "our", "their", "they",
  "team", "work", "experience", "role", "position", "company", "job",
  "looking", "seeking", "candidate", "must", "should", "can", "able",
  "strong", "excellent", "good", "great", "best", "high", "new", "etc",
  "please", "about", "also", "other", "more", "less", "than", "into",
  "within", "across", "through", "during", "including", "following",
  "required", "preferred", "plus", "bonus", "years", "year", "like",
  "time", "day", "week", "month", "working", "based", "knowledge",
  "understanding", "ability", "skills", "skill", "level", "type", "not",
  "all", "any", "both", "each", "few", "most", "who", "whom", "which",
  "what", "how", "its", "use", "used", "using", "well", "also", "just",
  "been", "such", "here", "there", "when", "where", "why", "while",
]);

const TECH_TERMS = new Set([
  "react", "typescript", "javascript", "python", "java", "golang", "rust",
  "nodejs", "docker", "kubernetes", "aws", "gcp", "azure", "sql", "postgresql",
  "mysql", "mongodb", "redis", "graphql", "rest", "api", "git", "linux",
  "terraform", "cicd", "devops", "agile", "scrum", "machine", "learning",
  "tensorflow", "pytorch", "frontend", "backend", "fullstack", "microservices",
  "cloud", "saas", "html", "css", "scss", "vue", "angular", "svelte",
  "django", "flask", "rails", "spring", "express", "fastapi", "webpack",
  "vite", "nextjs", "jest", "cypress", "selenium", "github", "gitlab",
  "jenkins", "ansible", "kafka", "rabbitmq", "elasticsearch", "nginx",
  "hadoop", "spark", "scala", "kotlin", "swift", "flutter", "android",
  "ios", "firebase", "supabase", "prisma", "orm", "cli", "sdk", "api",
  "grpc", "websocket", "oauth", "jwt", "http", "https", "tcp", "dns",
  "ml", "nlp", "llm", "openai", "langchain", "rag", "embedding",
  "pandas", "numpy", "sklearn", "scipy", "jupyter", "airflow", "dbt",
]);

const SOFT_SKILLS = new Set([
  "communication", "leadership", "collaboration", "teamwork", "ownership",
  "initiative", "motivation", "mentoring", "mentorship", "coaching",
  "analytical", "problem", "solving", "creative", "innovation", "strategy",
  "planning", "coordination", "organization", "detail", "oriented",
  "proactive", "adaptable", "self", "starter", "driven", "results",
]);

const ACTION_VERBS =
  /^(?:led|managed|built|developed|designed|created|implemented|delivered|drove|optimized|launched|achieved|improved|reduced|increased|established|coordinated|analyzed|generated|produced|collaborated|mentored|trained|automated|architected|deployed|migrated|scaled|enhanced|streamlined|owned|spearheaded|championed|negotiated|secured|facilitated|directed|maintained|oversaw|executed|supported|partnered|integrated|modernized|refactored|resolved|identified|evaluated|assessed|defined|shaped|crafted|engineered|authored|published)\b/i;

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

function isTechKeyword(word: string): boolean {
  if (TECH_TERMS.has(word)) return true;
  // All-caps acronyms (AWS, SQL, API, CI, CD)
  if (/^[A-Z]{2,}$/.test(word)) return true;
  // PascalCase compound words (TypeScript, GraphQL, PostgreSQL)
  if (/^[A-Z][a-z]{2,}[A-Z]/.test(word)) return true;
  return false;
}

function extractKeywords(text: string): string[] {
  const raw = text
    .replace(/[^a-zA-Z0-9+.#/\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-+.#/]+|[-+.#/]+$/g, "").trim())
    .filter((w) => w.length >= 3);

  const freq = new Map<string, number>();
  for (const w of raw) {
    const lower = w.toLowerCase();
    if (!STOPWORDS.has(lower)) {
      freq.set(lower, (freq.get(lower) ?? 0) + 1);
    }
  }

  return [...freq.entries()]
    .sort(([a, fa], [b, fb]) => {
      const wA = isTechKeyword(a) ? 2 : SOFT_SKILLS.has(a) ? 1 : 1;
      const wB = isTechKeyword(b) ? 2 : SOFT_SKILLS.has(b) ? 1 : 1;
      return wB * fb - wA * fa;
    })
    .slice(0, 60)
    .map(([word]) => word);
}

// ---------------------------------------------------------------------------
// Sub-score calculators
// ---------------------------------------------------------------------------

function calcKeywordMatch(
  resumeContent: string,
  jdText: string,
): { score: number; matched: string[]; missing: string[] } {
  const jdKeywords = extractKeywords(jdText);
  const resumeTokens = new Set(
    resumeContent
      .toLowerCase()
      .replace(/[^a-z0-9+.#/\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3),
  );

  let weightedMatched = 0;
  let weightedTotal = 0;
  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of jdKeywords) {
    const weight = isTechKeyword(kw) ? 2 : 1;
    weightedTotal += weight;
    if (resumeTokens.has(kw)) {
      weightedMatched += weight;
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const score =
    weightedTotal > 0
      ? Math.min(100, Math.round((weightedMatched / weightedTotal) * 100))
      : 100;

  // Surface tech-weighted missing keywords first
  missing.sort((a, b) => (isTechKeyword(b) ? 1 : 0) - (isTechKeyword(a) ? 1 : 0));

  return { score, matched, missing: missing.slice(0, 10) };
}

function calcFormatting(content: string): number {
  let score = 0;

  // Standard section headings (30 pts)
  const hasExperience = /\b(experience|work\s+history|employment)\b/i.test(content);
  const hasEducation = /\beducation\b/i.test(content);
  const hasSkills = /\bskills?\b/i.test(content);
  score += (hasExperience ? 10 : 0) + (hasEducation ? 10 : 0) + (hasSkills ? 10 : 0);

  // Bullet points (30 pts)
  const bulletLines = content.split("\n").filter((l) => /^[-•*]\s/.test(l.trim()));
  if (bulletLines.length >= 5) score += 30;
  else if (bulletLines.length >= 2) score += 15;

  // No overlong paragraphs — lines > 150 chars without a heading (20 pts)
  const contentLines = content
    .split("\n")
    .filter((l) => l.trim() && !l.trim().startsWith("#"));
  const longLines = contentLines.filter((l) => l.length > 150);
  if (longLines.length === 0) score += 20;
  else if (longLines.length <= 2) score += 10;

  // Contact info — email pattern (20 pts)
  const hasEmail = /[\w.+]+@[\w.]+\.\w{2,}/.test(content);
  if (hasEmail) score += 20;

  return Math.min(100, score);
}

function calcReadability(content: string): number {
  let score = 0;

  // Action-verb-led bullets (40 pts)
  const bulletLines = content
    .split("\n")
    .filter((l) => /^[-•*]\s/.test(l.trim()))
    .map((l) => l.replace(/^[-•*]\s+/, "").trim());

  if (bulletLines.length > 0) {
    const actionRatio =
      bulletLines.filter((b) => ACTION_VERBS.test(b)).length / bulletLines.length;
    score += Math.round(actionRatio * 40);
  } else {
    score += 20;
  }

  // Average sentence length (30 pts — under 20 words is good)
  const sentences = content
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10 && s.split(/\s+/).length >= 3);

  if (sentences.length > 0) {
    const avgWords =
      sentences.reduce((sum, s) => sum + s.split(/\s+/).length, 0) / sentences.length;
    if (avgWords <= 20) score += 30;
    else if (avgWords <= 30) score += 20;
    else score += 10;
  } else {
    score += 25;
  }

  // No first-person pronouns (30 pts)
  const firstPerson = (content.match(/\b(I|my|me|I'm|I've|I'd|myself)\b/g) ?? []).length;
  if (firstPerson === 0) score += 30;
  else if (firstPerson <= 2) score += 15;

  return Math.min(100, score);
}

function calcLengthScore(content: string): number {
  // Strip markdown syntax before counting words
  const stripped = content
    .replace(/^#{1,3}\s+.*/gm, "")
    .replace(/[-•*]\s+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = stripped.split(/\s+/).filter((w) => w.length > 0).length;

  if (wordCount >= 400 && wordCount <= 700) return 100;
  if (wordCount < 400) return Math.max(0, Math.round((wordCount / 400) * 100));
  // Over 700 — linear penalty
  if (wordCount <= 1000) return Math.max(0, Math.round(100 - ((wordCount - 700) / 300) * 40));
  return Math.max(0, Math.round(60 - ((wordCount - 1000) / 500) * 60));
}

function generateSuggestions(
  breakdown: ATSResult["breakdown"],
  missingKeywords: string[],
): string[] {
  const tips: string[] = [];

  if (missingKeywords.length > 0) {
    const topMissing = missingKeywords
      .filter((k) => isTechKeyword(k))
      .slice(0, 3)
      .map((k) => `"${k}"`)
      .join(", ");
    if (topMissing) {
      tips.push(`Add ${topMissing} if you have relevant experience — these appear in the JD.`);
    }
  }

  if (breakdown.readability < 70) {
    tips.push("Start more bullet points with strong action verbs (Led, Built, Delivered, etc.).");
    tips.push("Remove first-person pronouns (I, my, me) from bullets — use implied subject.");
  }

  if (breakdown.formatting < 70) {
    tips.push(
      "Ensure your resume includes standard section headings: Experience, Education, Skills.",
    );
  }

  if (breakdown.keywordMatch < 60) {
    tips.push("Mirror the exact phrasing used in the job description for key technologies.");
  }

  if (breakdown.lengthScore < 70) {
    tips.push("Aim for 400–700 words for optimal ATS parsing.");
  }

  return tips.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function calculateATSScore(
  resumeContent: string,
  jobDescription: string,
): ATSResult {
  const { score: keywordMatch, matched, missing } = calcKeywordMatch(
    resumeContent,
    jobDescription,
  );
  const formatting = calcFormatting(resumeContent);
  const readability = calcReadability(resumeContent);
  const lengthScore = calcLengthScore(resumeContent);

  const breakdown = { keywordMatch, formatting, readability, lengthScore };
  const overall = Math.round(
    keywordMatch * 0.35 + formatting * 0.25 + readability * 0.25 + lengthScore * 0.15,
  );

  return {
    overall,
    breakdown,
    suggestions: generateSuggestions(breakdown, missing),
    matchedKeywords: matched,
    missingKeywords: missing,
  };
}
