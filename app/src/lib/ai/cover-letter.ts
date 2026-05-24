import { aiText } from "./provider";
import { selectResumeEvidenceSemantic, resumeToText, jobToText } from "./evidence";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are a cover letter writing assistant.

Given the candidate's parsed resume and a parsed job description, write a concise, role-specific cover letter.

Rules:
- 3 to 4 short paragraphs.
- Open with why the candidate is interested in this specific company/role.
- Second paragraph: 2-3 concrete examples from the candidate's actual experience that align with the posting.
- Third paragraph: fit / working style / what they'd bring.
- Never fabricate details, metrics, employers, or accomplishments not present in the resume.
- Warm but professional. No clichés like "I'm excited to apply for this opportunity".
- Output plain text only, no subject line, no markdown, no signature block beyond "Sincerely, {Name}".`;

export async function generateCoverLetter({
  resume,
  job,
  extraInstructions,
}: {
  resume: ParsedResume;
  job: ParsedJob;
  extraInstructions?: string;
}): Promise<string> {
  const matchedEvidence = (await selectResumeEvidenceSemantic(resumeToText(resume), jobToText(job))).join('\n\n');

  return aiText({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Candidate parsed resume (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
          extraInstructions
            ? `Additional instructions:\n${extraInstructions}`
            : "",
          "Write the cover letter.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    maxTokens: 2048,
  });
}
