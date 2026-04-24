import { aiJson } from "./provider";
import { assessmentAnalysisSchema } from "./schemas";
import type { AssessmentAnalysis, ParsedJob } from "@/lib/db/types";

const SYSTEM = `You are an assessment analysis assistant.

A candidate will paste the assessment instructions they received. Analyze them and return a JSON object:

type AssessmentAnalysis = {
  summary: string;
  deliverables: string[];
  evaluation_criteria: string[];
  preparation_steps: string[];
  checklist: string[];
  estimated_effort_hours?: number;
};

Rules:
- Be specific; avoid generic advice.
- evaluation_criteria may be inferred from the brief but should be clearly framed as likely criteria, not facts.
- Output a single JSON object, no prose, no code fences.`;

export async function analyzeAssessment({
  assessmentText,
  job,
}: {
  assessmentText: string;
  job?: ParsedJob | null;
}): Promise<AssessmentAnalysis> {
  const raw = await aiJson<AssessmentAnalysis>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Assessment instructions:\n${assessmentText}`,
          job
            ? `Context — parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`
            : "",
          "Return the AssessmentAnalysis JSON.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    maxTokens: 2500,
  });
  const validated = assessmentAnalysisSchema.safeParse(raw);
  if (!validated.success) {
    console.error("[analyzeAssessment] Schema validation failed:", validated.error);
    throw new Error("AI returned an unexpected response format.");
  }
  return validated.data;
}
