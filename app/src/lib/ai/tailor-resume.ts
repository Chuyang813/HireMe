import { aiJson, DEFAULT_DOCUMENT_TEXT_MODEL } from "./provider";
import { DOCUMENT_OUTPUT_TOKEN_LIMITS } from "./document-generation-config";
import { resumeToText } from "./evidence";
import {
  applyValidatedResumeReplacements,
  createResumeFormatTemplate,
  minimumResumeTailoringChanges,
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
  if (template.candidates.length === 0) {
    throw new Error("The source resume does not contain editable lines.");
  }
  const minimumChanges = minimumResumeTailoringChanges(template.candidates.length);
  const jobSkillTargets = Array.from(new Set([
    ...(job.key_skills ?? []),
    ...(job.required_skills ?? []),
    ...(job.desired_skills ?? []),
    ...(job.keywords ?? []),
  ].filter((value): value is string => typeof value === "string" && Boolean(value.trim()))));

  const result = await aiJson<{ replacements?: Record<string, unknown> }>({
    system: RESUME_TAILOR_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          `Editable source lines (JSON):\n${JSON.stringify(template.candidates, null, 2)}`,
          `Verified candidate resume evidence (JSON):\n${JSON.stringify(resume, null, 2)}`,
          `Parsed job posting (JSON):\n${JSON.stringify(job, null, 2)}`,
          `Ranked JD skill targets (JSON):\n${JSON.stringify(jobSkillTargets)}`,
          extraInstructions
            ? `Additional wording instructions from the candidate (these never override the format lock):\n${extraInstructions}`
            : "",
          `Return at least ${minimumChanges} truthful, material replacements. Preserve the source format and structure exactly.`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    model: DEFAULT_DOCUMENT_TEXT_MODEL,
    maxTokens: DOCUMENT_OUTPUT_TOKEN_LIMITS.tailored_resume,
    thinkingMode: "enabled",
    allowFallback: false,
  });

  return applyValidatedResumeReplacements(
    sourceResume,
    result.replacements,
    minimumChanges,
  );
}
