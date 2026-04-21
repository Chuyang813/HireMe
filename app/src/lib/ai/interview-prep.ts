import { claudeJson } from "./anthropic";
import type { InterviewPrep, ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are an interview preparation assistant.

Given the parsed job posting and the candidate's parsed resume, produce a JSON object:

type InterviewPrep = {
  likely_questions: Array<{
    question: string;
    category: "behavioral" | "technical" | "role_specific" | "company";
    rationale?: string;
    star_answer?: string;
  }>;
  preparation_checklist: string[];
  talking_points: string[];
};

Rules:
- Provide 8–12 likely_questions across the four categories.
- For behavioral questions: write star_answer in STAR format using the candidate's real experience — "Situation: ... Task: ... Action: ... Result: ..." with 1–2 sentences per section.
- For technical and role_specific questions: write star_answer as a brief outline of a strong answer grounded in the candidate's actual skills and projects.
- For company questions: omit star_answer or write a short preparation tip.
- talking_points should be short, first-person bullet phrases grounded in the candidate's real experience.
- Never fabricate the candidate's experience.
- Output a single JSON object, no prose, no code fences.`;

export async function generateInterviewPrep({
  resume,
  job,
  interviewStage,
}: {
  resume: ParsedResume;
  job: ParsedJob;
  interviewStage?: string;
}): Promise<InterviewPrep> {
  return claudeJson<InterviewPrep>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Candidate parsed resume (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          interviewStage
            ? `Interview stage: ${interviewStage}`
            : "Interview stage: not specified",
          "Return the InterviewPrep JSON.",
        ].join("\n\n"),
      },
    ],
    maxTokens: 3000,
  });
}
