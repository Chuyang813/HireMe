export type DocumentAiOptions = {
  model: string;
  thinkingMode: "disabled";
};

export const COVER_LETTER_MAX_OUTPUT_TOKENS = 8_192;

export function createDocumentAiOptions(model: string): DocumentAiOptions {
  return {
    model,
    // Keep the high-quality model, but reserve its output budget for the
    // document body. Long resumes can otherwise spend the budget on hidden
    // reasoning and return no usable text.
    thinkingMode: "disabled",
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
