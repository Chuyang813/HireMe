export type DocumentAiOptions = {
  model: string;
  thinkingMode: "enabled" | "disabled";
};

export const DOCUMENT_MAX_OUTPUT_TOKENS = 8_192;
export const DOCUMENT_MODEL_TIMEOUT_MS = 240_000;
export const DOCUMENT_STREAM_TIMEOUT_MS = 270_000;

export const DOCUMENT_OUTPUT_TOKEN_LIMITS = {
  tailored_resume: DOCUMENT_MAX_OUTPUT_TOKENS,
  cover_letter: DOCUMENT_MAX_OUTPUT_TOKENS,
  email_draft: DOCUMENT_MAX_OUTPUT_TOKENS,
  interview_prep: DOCUMENT_MAX_OUTPUT_TOKENS,
} as const;

export function createDocumentAiOptions(
  model: string,
  thinkingMode: DocumentAiOptions["thinkingMode"] = "disabled",
): DocumentAiOptions {
  return {
    model,
    // Resume tailoring can opt into reasoning; other document types reserve
    // the full output budget for the visible document body.
    thinkingMode,
  };
}

function retryMessage(message: string, isDemo: boolean, shortly = false): string {
  const demoNote = isDemo ? " Your demo allowance was not used." : "";
  return `${message}${demoNote} Please try again${shortly ? " shortly" : ""}.`;
}

export function documentGenerationErrorMessage(
  error: unknown,
  options: { isDemo?: boolean } = {},
): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLocaleLowerCase();
  const isDemo = options.isDemo === true;

  if (
    normalized.includes("enough supported changes")
    || normalized.includes("does not contain editable lines")
  ) {
    return retryMessage(
      "The resume could not be tailored with verified JD-matched changes.",
      isDemo,
    );
  }

  if (normalized.includes("timed out") || normalized.includes("aborterror")) {
    return retryMessage("High-quality generation took too long.", isDemo);
  }
  if (
    normalized.includes("returned no text")
    || normalized.includes("finish reason: length")
  ) {
    return retryMessage("The document could not be completed.", isDemo);
  }
  if (
    normalized.includes("429")
    || normalized.includes("rate limit")
    || normalized.includes("overloaded")
    || normalized.includes("busy")
  ) {
    return retryMessage("The high-quality model is busy right now.", isDemo, true);
  }

  return retryMessage("High-quality generation failed.", isDemo);
}
