import { aiJson } from "./provider";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are an email drafting assistant for job applications submitted by email.

Produce a JSON object with this shape:
{
  "subject": string,
  "body": string,            // plain text, short paragraphs, no markdown
  "attachments": string[]    // e.g. ["Resume.pdf", "Cover Letter.pdf"]
}

Rules:
- Subject is concise, includes the role title and candidate name.
- Body: short greeting, one-paragraph pitch grounded in the candidate's actual background, closing with what's attached.
- Never fabricate experience or metrics.
- Output a single JSON object, no prose, no code fences.`;

export type EmailDraft = {
  subject: string;
  body: string;
  attachments: string[];
};

export async function generateEmailDraft({
  resume,
  job,
}: {
  resume: ParsedResume;
  job: ParsedJob;
}): Promise<EmailDraft> {
  return aiJson<EmailDraft>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Candidate parsed resume (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          "Return the email JSON.",
        ].join("\n\n"),
      },
    ],
    maxTokens: 1500,
  });
}
