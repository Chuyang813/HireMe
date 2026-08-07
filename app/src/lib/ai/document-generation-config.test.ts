import { describe, expect, it } from "vitest";
import {
  DOCUMENT_MAX_OUTPUT_TOKENS,
  DOCUMENT_MODEL_TIMEOUT_MS,
  DOCUMENT_OUTPUT_TOKEN_LIMITS,
  DOCUMENT_STREAM_TIMEOUT_MS,
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

  it("gives every generated document the provider's full output allowance", () => {
    expect(new Set(Object.values(DOCUMENT_OUTPUT_TOKEN_LIMITS))).toEqual(
      new Set([DOCUMENT_MAX_OUTPUT_TOKENS]),
    );
    expect(DOCUMENT_MAX_OUTPUT_TOKENS).toBe(8_192);
  });

  it("keeps the model timeout below the stream and function ceilings", () => {
    expect(DOCUMENT_MODEL_TIMEOUT_MS).toBe(240_000);
    expect(DOCUMENT_STREAM_TIMEOUT_MS).toBe(270_000);
    expect(DOCUMENT_MODEL_TIMEOUT_MS).toBeLessThan(DOCUMENT_STREAM_TIMEOUT_MS);
  });
});
