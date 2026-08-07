import { aiJson, DEFAULT_DOCUMENT_TEXT_MODEL } from "./provider";
import { selectResumeEvidenceSemantic, resumeToText, jobToText } from "./evidence";
import {
  extractResumeHeader,
  renderCoverLetterWithResumeFormat,
  type CoverLetterDraft,
} from "./resume-format";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are a cover letter writing assistant.

Given the candidate's parsed resume, exact source-resume header, and a parsed job description, return the content fields for a concise, role-specific cover letter.

Rules:
- Write a specific opening, 3-4 short titled evidence sections, and a confident final paragraph. Keep the total under 450 words so the application can fit it inside the source resume's own page size and margins.
- Each section heading must be concise Title Case plain text that names the evidence theme; the application will render it in bold.
- Open with why the candidate is interested in this specific company and role.
- Use 2-3 concrete examples from the candidate's actual experience that align with the posting.
- Explain fit and what the candidate would bring.
- Never fabricate details, metrics, employers, or accomplishments not present in the resume.
- Stay warm but professional and avoid generic opening clichés.
- The application, not you, controls layout and inherits the uploaded resume's own page size, margins, fonts, colors, header, and spacing. Do not assume Letter or A4 and do not add Markdown, bullets, or formatting instructions.
- Use a concise subject line in the form "Re: Position Title".
- Output exactly this JSON shape and no commentary: {"date":"...","recipient":["Company","Location"],"subject":"Re: Position Title","greeting":"Dear Hiring Manager,","opening":"...","sections":[{"heading":"Evidence Theme","paragraph":"..."}],"finalParagraph":"...","closing":"Sincerely,","signature":"Candidate Name"}.`;

export async function generateCoverLetter({
  resume,
  job,
  rawResumeText,
  extraInstructions,
}: {
  resume: ParsedResume;
  job: ParsedJob;
  rawResumeText?: string | null;
  extraInstructions?: string;
}): Promise<string> {
  const sourceResume = rawResumeText?.trim() ? rawResumeText : resumeToText(resume);
  const header = extractResumeHeader(sourceResume);
  const matchedEvidence = (
    await selectResumeEvidenceSemantic(resumeToText(resume), jobToText(job))
  ).join("\n\n");

  const draft = await aiJson<CoverLetterDraft>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Exact source-resume header to be reused by the application (JSON):\n${JSON.stringify(header)}`,
          `Candidate parsed resume (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
          extraInstructions ? `Additional content instructions:\n${extraInstructions}` : "",
          "Return only the cover-letter content JSON. The application will render it with the resume's header and spacing conventions.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    model: DEFAULT_DOCUMENT_TEXT_MODEL,
    maxTokens: 2048,
    allowFallback: false,
  });

  return renderCoverLetterWithResumeFormat(sourceResume, draft);
}
