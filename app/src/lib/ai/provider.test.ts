import { describe, expect, it } from "vitest";
import { extractJson } from "./provider";

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
