import { describe, expect, it } from "vitest";
import {
  COVER_LETTER_MAX_OUTPUT_TOKENS,
  createDocumentAiOptions,
  documentGenerationErrorMessage,
} from "./document-generation-config";

describe("document generation configuration", () => {
  it("keeps the high-quality model while reserving tokens for visible output", () => {
    expect(createDocumentAiOptions("deepseek-v4-pro")).toEqual({
      model: "deepseek-v4-pro",
      thinkingMode: "disabled",
    });
  });

  it("mentions allowances only for demo users", () => {
    const error = new Error("DeepSeek returned no text. Finish reason: length.");

    expect(documentGenerationErrorMessage(error)).toBe(
      "The document could not be completed. Please try again.",
    );
    expect(documentGenerationErrorMessage(error, { isDemo: true })).toContain(
      "Your demo allowance was not used.",
    );
  });

  it("distinguishes provider load from generic failures", () => {
    expect(documentGenerationErrorMessage(new Error("status 429"))).toContain(
      "busy right now",
    );
    expect(documentGenerationErrorMessage(new Error("unexpected"))).not.toContain(
      "allowance",
    );
  });

  it("gives cover letters enough output room while the prompt controls length", () => {
    expect(COVER_LETTER_MAX_OUTPUT_TOKENS).toBe(8_192);
  });
});
