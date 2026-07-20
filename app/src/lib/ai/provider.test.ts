import { describe, expect, it } from "vitest";
import { extractJson, resolveDocumentTextModel } from "./provider";

describe("extractJson", () => {
  it("parses fenced JSON", () => {
    expect(extractJson("```json\n{\"score\": 92}\n```")).toEqual({ score: 92 });
  });

  it("parses JSON surrounded by prose", () => {
    expect(extractJson("Here is the result: {\"ok\": true} Thanks.")).toEqual({
      ok: true,
    });
  });

  it("throws when no JSON object is present", () => {
    expect(() => extractJson("no structured output")).toThrow("No JSON object");
  });
});

describe("resolveDocumentTextModel", () => {
  it("uses non-reasoning chat generation for DeepSeek documents", () => {
    expect(resolveDocumentTextModel("deepseek", "deepseek-v4-pro")).toBe(
      "deepseek-chat",
    );
  });

  it("keeps the provider default for non-DeepSeek documents", () => {
    expect(resolveDocumentTextModel("gemini", "gemini-3.1-flash-lite")).toBe(
      "gemini-3.1-flash-lite",
    );
  });

  it("honors an explicit document model override", () => {
    expect(
      resolveDocumentTextModel("deepseek", "deepseek-v4-pro", " custom-model "),
    ).toBe("custom-model");
  });
});
