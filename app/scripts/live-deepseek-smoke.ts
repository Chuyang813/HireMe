import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(".env.local");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  if (!line || line.trim().startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx > 0) process.env[line.slice(0, idx)] = line.slice(idx + 1);
}

process.env.AI_PROVIDER = "deepseek";
process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
process.env.DEEPSEEK_TEXT_THINKING = "disabled";
process.env.DEEPSEEK_THINKING = "enabled";
process.env.ENABLE_GEMINI_FALLBACK = "false";
process.env.ENABLE_GLM_FALLBACK = "false";
process.env.ENABLE_SEMANTIC_EVIDENCE = "true";

type AiCall = {
  url: string;
  model?: string;
  thinking?: string;
  response_format?: string;
};

type SmokeResult = {
  name: string;
  ok: boolean;
  ms: number;
  calls: AiCall[];
  summary?: string;
  error?: string;
};

const originalFetch = globalThis.fetch;
const calls: AiCall[] = [];

globalThis.fetch = async (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  let body:
    | {
        model?: string;
        thinking?: { type?: string };
        response_format?: { type?: string };
      }
    | undefined;
  try {
    body = init?.body ? JSON.parse(String(init.body)) : undefined;
  } catch {
    body = undefined;
  }

  if (/deepseek|googleapis|generativelanguage|z\.ai|anthropic/i.test(url)) {
    calls.push({
      url,
      model: body?.model,
      thinking: body?.thinking?.type,
      response_format: body?.response_format?.type,
    });
  }

  return originalFetch(input, init);
};

const jobText = `Acme AI is hiring an AI Engineering Intern in Toronto.
Required: Python, TypeScript, React, SQL, RAG, prompt evaluation, and strong communication.
Nice to have: Supabase and Next.js.
Apply by email to careers@acme.example with resume and cover letter.`;

const resumeText = `Alex Chen
alex@example.com | Toronto
Education: University of Toronto, BASc Computer Engineering, 2024-2028
Experience: AI Product Intern at Campus Labs. Built a RAG assistant using Python, React, PostgreSQL, and evaluation scripts. Improved answer grounding by adding citation checks.
Project: HireMe AI job assistant using Next.js, Supabase, TypeScript, structured LLM outputs, prompt versioning, and offline evals.
Skills: Python, TypeScript, React, SQL, Next.js, Supabase, RAG, prompt engineering, testing.`;

const results: SmokeResult[] = [];

async function run<T>(
  name: string,
  fn: () => Promise<T>,
  check: (value: T) => boolean,
) {
  const before = calls.length;
  const start = Date.now();
  try {
    const value = await fn();
    const newCalls = calls.slice(before);
    results.push({
      name,
      ok: check(value),
      ms: Date.now() - start,
      calls: newCalls,
      summary:
        typeof value === "string"
          ? value.slice(0, 120)
          : JSON.stringify(value).slice(0, 160),
    });
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - start,
      calls: calls.slice(before),
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main() {
  const { analyzeAssessment } = await import("../src/lib/ai/assessment");
  const { generateCoverLetter } = await import("../src/lib/ai/cover-letter");
  const { generateEmailDraft } = await import("../src/lib/ai/email-draft");
  const { embedText } = await import("../src/lib/ai/embeddings");
  const {
    jobToText,
    resumeToText,
    selectResumeEvidenceSemantic,
  } = await import("../src/lib/ai/evidence");
  const { generateInterviewPrep } = await import("../src/lib/ai/interview-prep");
  const { parseJobPosting } = await import("../src/lib/ai/job-parser");
  const { aiJson, AI_PROVIDER, DEFAULT_MODEL } = await import("../src/lib/ai/provider");
  const { parseResume } = await import("../src/lib/ai/resume-parser");
  const { tailorResume } = await import("../src/lib/ai/tailor-resume");

  console.log(JSON.stringify({ provider: AI_PROVIDER, defaultModel: DEFAULT_MODEL }));

  let parsedJob: Awaited<ReturnType<typeof parseJobPosting>>;
  let parsedResume: Awaited<ReturnType<typeof parseResume>>;

  await run(
    "parseJobPosting",
    async () => (parsedJob = await parseJobPosting(jobText)),
    (value) => Boolean(value.role_title && Array.isArray(value.required_skills)),
  );

  await run(
    "parseResume",
    async () => (parsedResume = await parseResume(resumeText)),
    (value) => Boolean(value.name && Array.isArray(value.skills)),
  );

  await run(
    "embedText.deepseekEndpoint",
    async () => {
      const embedding = await embedText("DeepSeek embedding direct smoke");
      return { dimensions: embedding?.length ?? 0 };
    },
    (value) => value.dimensions === 1536,
  );

  await run(
    "selectResumeEvidenceSemantic",
    async () =>
      selectResumeEvidenceSemantic(
        resumeToText(parsedResume),
        jobToText(parsedJob),
        3,
      ),
    (value) => Array.isArray(value) && value.length > 0,
  );

  await run(
    "analyzeAssessment",
    async () =>
      analyzeAssessment({
        assessmentText:
          "Build a small RAG demo, document tradeoffs, and present evaluation metrics.",
        job: parsedJob,
      }),
    (value) => Array.isArray(value.deliverables),
  );

  await run(
    "scoreResume.aiJson",
    async () =>
      aiJson<{
        score: number;
        strengths: string[];
        gaps: string[];
        suggestions: string[];
      }>({
        system:
          'Score resume match. Return only JSON: {"score":number,"strengths":string[],"gaps":string[],"suggestions":string[]}',
        messages: [
          {
            role: "user",
            content: `JOB:\n${jobText}\n\nRESUME:\n${resumeText}`,
          },
        ],
        maxTokens: 700,
      }),
    (value) => typeof value.score === "number",
  );

  await run(
    "tailorResume",
    async () => tailorResume({ resume: parsedResume, job: parsedJob }),
    (value) => typeof value === "string" && value.length > 200,
  );

  await run(
    "generateCoverLetter",
    async () => generateCoverLetter({ resume: parsedResume, job: parsedJob }),
    (value) => typeof value === "string" && value.length > 200,
  );

  await run(
    "generateEmailDraft",
    async () =>
      generateEmailDraft({
        resume: parsedResume,
        job: parsedJob,
        rawJobText: jobText,
      }),
    (value) => Boolean(value.subject && value.body && Array.isArray(value.attachments)),
  );

  await run(
    "generateInterviewPrep",
    async () =>
      generateInterviewPrep({
        resume: parsedResume,
        job: parsedJob,
        interviewStage: "first round technical screen",
      }),
    (value) => typeof value === "string" && value.includes("Role Understanding"),
  );

  const foreignCalls = calls.filter((call) => !call.url.includes("api.deepseek.com"));
  console.log(JSON.stringify({ results, totalCalls: calls.length, calls, foreignCalls }, null, 2));

  if (results.some((result) => !result.ok) || foreignCalls.length > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
