export type DocumentAiOptions = {
  model: string;
  thinkingMode: "disabled";
};

export function createDocumentAiOptions(model: string): DocumentAiOptions {
  return {
    model,
    // Keep the high-quality model, but reserve its output budget for the
    // document body. Long resumes can otherwise spend the budget on hidden
    // reasoning and return no usable text.
    thinkingMode: "disabled",
  };
}

export function documentGenerationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLocaleLowerCase();

  if (normalized.includes("timed out") || normalized.includes("aborterror")) {
    return "High-quality generation took too long. Your allowance was not used; please try again.";
  }
  if (
    normalized.includes("returned no text")
    || normalized.includes("finish reason: length")
  ) {
    return "The high-quality model ran out of output space before finishing. Your allowance was not used; please try again.";
  }
  if (
    normalized.includes("429")
    || normalized.includes("rate limit")
    || normalized.includes("overloaded")
    || normalized.includes("busy")
  ) {
    return "The high-quality model is busy right now. Your allowance was not used; please try again shortly.";
  }

  return "High-quality generation failed. Your allowance was not used; please try again.";
}
