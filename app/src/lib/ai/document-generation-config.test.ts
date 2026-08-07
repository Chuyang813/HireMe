import { describe, expect, it } from "vitest";
import {
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

  it("explains output-budget failures without consuming the allowance", () => {
    expect(
      documentGenerationErrorMessage(
        new Error("DeepSeek returned no text. Finish reason: length."),
      ),
    ).toContain("ran out of output space");
  });

  it("distinguishes provider load from generic failures", () => {
    expect(documentGenerationErrorMessage(new Error("status 429"))).toContain(
      "busy right now",
    );
    expect(documentGenerationErrorMessage(new Error("unexpected"))).toContain(
      "allowance was not used",
    );
  });
});
