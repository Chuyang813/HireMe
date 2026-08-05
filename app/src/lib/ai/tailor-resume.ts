import { aiJson, DEFAULT_DOCUMENT_TEXT_MODEL } from "./provider";
import { selectResumeEvidenceSemantic, resumeToText, jobToText } from "./evidence";
import {
  applyResumeReplacements,
  createResumeFormatTemplate,
} from "./resume-format";
import { RESUME_TAILOR_SYSTEM_PROMPT } from "./resume-tailor-prompt";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

export async function tailorResume({
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
  const template = createResumeFormatTemplate(sourceResume);
  if (template.candidates.length === 0) return sourceResume;

  const matchedEvidence = (
    await selectResumeEvidenceSemantic(resumeToText(resume), jobToText(job))
  ).join("\n\n");

  const result = await aiJson<{ replacements?: Record<string, unknown> }>({
    system: RESUME_TAILOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Editable source lines (JSON):\n${JSON.stringify(template.candidates, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          `Most relevant candidate evidence selected for this job:\n${matchedEvidence}`,
          extraInstructions
            ? `Additional wording instructions from the candidate (these never override the format lock):\n${extraInstructions}`
            : "",
          "Return only the replacement-map JSON. Preserve the source format and structure exactly.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    model: DEFAULT_DOCUMENT_TEXT_MODEL,
    maxTokens: 4096,
  });

  return applyResumeReplacements(sourceResume, result.replacements);
}
