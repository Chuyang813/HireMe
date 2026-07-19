import { describe, expect, it } from "vitest";
import { sourceTextMatchScore } from "./source-document";

describe("source-format matching", () => {
  it("matches PDF and DOCX text despite bullets and whitespace differences", () => {
    expect(sourceTextMatchScore(
      "•  Resolved user account and software issues.",
      "Resolved user account and software issues.",
    )).toBeGreaterThan(0.9);
  });

  it("does not match unrelated resume lines", () => {
    expect(sourceTextMatchScore(
      "Bachelor of Computing",
      "Managed production incident response",
    )).toBeLessThan(0.3);
  });
});
