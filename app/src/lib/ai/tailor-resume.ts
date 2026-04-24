import { aiText } from "./provider";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are a resume tailoring assistant.

You will receive a candidate's parsed resume and a parsed job description. Produce a tailored, role-aligned resume in clean plaintext Markdown.

Absolute rules:
- Never invent employers, schools, dates, titles, degrees, certifications, tools, or accomplishments.
- You may reorganize, reprioritize, and rephrase bullets the candidate already has. You may drop weakly-relevant items.
- Highlight experience, projects, and skills that align with the job's required and desired skills.
- Keep the candidate's factual claims intact; only the framing changes.
- Use simple Markdown: # Name, contact line, ## Sections, - bullets.
- Do not include any preamble or trailing commentary. Output only the resume.`;

export async function tailorResume({
  resume,
  job,
  extraInstructions,
}: {
  resume: ParsedResume;
  job: ParsedJob;
  extraInstructions?: string;
}): Promise<string> {
  return aiText({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Candidate parsed resume (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          extraInstructions
            ? `Additional instructions from the candidate:\n${extraInstructions}`
            : "",
          "Write the tailored resume as Markdown. Only output the resume.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    maxTokens: 4096,
  });
}
