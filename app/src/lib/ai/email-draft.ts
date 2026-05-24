import { aiJson } from "./provider";
import { formatResumeEvidence, selectResumeEvidence } from "./evidence";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are an email drafting assistant for job applications submitted by email.

Produce a JSON object with this shape:
{
  "subject": string,
  "body": string,            // plain text, short paragraphs, no markdown
  "signature": string,       // starts with "Best regards," and includes name/contact details from resume
  "attachments": Array<{ "name": string, "reason": string }>
}

Rules:
- Subject is concise, includes the role title and candidate name.
- Body: short greeting, one-paragraph pitch grounded in the candidate's actual background, and one short closing line.
- Signature: always include "Best regards," then candidate full name, then a contact line using only resume-provided email, phone, and location.
- Attachments: suggest only files the candidate should attach for this posting.
- Always include the tailored resume.
- Include a cover letter only if the posting asks for a cover letter or motivation letter.
- Include a transcript if the posting mentions transcript, GPA, academic record, or official records.
- Include portfolio/work samples/writing samples/references/certifications only when the posting requests them.
- Each attachment needs a short reason tied to the posting.
- Never fabricate experience or metrics.
- Output a single JSON object, no prose, no code fences.`;

export type EmailAttachmentSuggestion = {
  name: string;
  reason: string;
};

export type EmailDraft = {
  subject: string;
  body: string;
  signature: string;
  attachments: EmailAttachmentSuggestion[];
};

export async function generateEmailDraft({
  resume,
  job,
  rawJobText,
}: {
  resume: ParsedResume;
  job: ParsedJob;
  rawJobText?: string | null;
}): Promise<EmailDraft> {
  const matchedEvidence = formatResumeEvidence(selectResumeEvidence({ resume, job, limit: 5 }));

  return aiJson<EmailDraft>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Candidate parsed resume (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
          rawJobText ? `Raw job posting text:\n${rawJobText}` : "",
          "Return the email JSON.",
        ].filter(Boolean).join("\n\n"),
      },
    ],
    maxTokens: 1500,
  });
}
