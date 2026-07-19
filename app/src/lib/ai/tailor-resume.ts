import { aiJson } from "./provider";
import { selectResumeEvidenceSemantic, resumeToText, jobToText } from "./evidence";
import {
  applyResumeReplacements,
  createResumeFormatTemplate,
} from "./resume-format";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are a resume tailoring assistant.

You will receive immutable source-resume lines and a parsed job description. Return a JSON object containing replacement text only for the supplied editable line IDs.

Absolute rules:
- Never invent employers, schools, dates, titles, degrees, certifications, tools, or accomplishments.
- Never add, remove, merge, split, or reorder lines, bullets, jobs, projects, or sections.
- Never return a replacement for an ID that was not supplied.
- Keep every factual claim intact. Rephrase only when it improves alignment with the job.
- Keep each replacement at or below the source line's approximate character length so it remains inside the original text box without changing font size, line spacing, or pagination.
- Do not include bullet symbols, indentation, Markdown, headings, or line breaks inside replacement values; the application restores those from the source template.
- If a source line should remain unchanged, omit its ID.
- Output exactly this JSON shape and no commentary: {"replacements":{"L0001":"replacement text"}}.`;

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
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Immutable source resume (verbatim):\n${sourceResume}`,
          `Editable source lines (JSON):\n${JSON.stringify(template.candidates, null, 2)}`,
          `Candidate parsed resume for fact checking only (JSON):\n${JSON.stringify(resume, null, 2)}`,
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
    maxTokens: 4096,
  });

  return applyResumeReplacements(sourceResume, result.replacements);
}
