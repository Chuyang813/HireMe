import { describe, expect, it } from "vitest";
import {
  extractJson,
  resolveDeepSeekThinkingPayload,
  resolveDocumentTextModel,
  resolveFastTextModel,
} from "./provider";

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
  it("uses the configured high-quality default for generated documents", () => {
    expect(resolveDocumentTextModel("deepseek-v4-pro")).toBe("deepseek-v4-pro");
  });

  it("uses non-reasoning chat generation for fast DeepSeek parsing", () => {
    expect(resolveFastTextModel("deepseek", "deepseek-v4-pro")).toBe("deepseek-chat");
  });

  it("honors an explicit document model override", () => {
    expect(resolveDocumentTextModel("deepseek-v4-pro", " custom-model ")).toBe("custom-model");
  });
});

describe("resolveDeepSeekThinkingPayload", () => {
  it("explicitly disables default thinking for V4 document generation", () => {
    expect(resolveDeepSeekThinkingPayload("deepseek-v4-pro", "disabled")).toEqual({
      thinking: { type: "disabled" },
    });
  });

  it("does not add an unsupported disabled field to legacy chat aliases", () => {
    expect(resolveDeepSeekThinkingPayload("deepseek-chat", "disabled")).toEqual({});
  });
});
