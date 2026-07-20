import { describe, expect, it } from "vitest";
import { joinPdfTextItems } from "./resume-text";

describe("PDF resume text reconstruction", () => {
  it("restores spaces between separate words on the same PDF line", () => {
    expect(joinPdfTextItems([
      { str: "Senior", transform: [10, 0, 0, 10, 10, 100], width: 30, height: 10 },
      { str: "Designer", transform: [10, 0, 0, 10, 45, 100], width: 40, height: 10 },
    ])).toBe("Senior Designer");
  });

  it("does not split font fragments that have no horizontal gap", () => {
    expect(joinPdfTextItems([
      { str: "Soft", transform: [10, 0, 0, 10, 10, 100], width: 20, height: 10 },
      { str: "ware", transform: [10, 0, 0, 10, 30, 100], width: 22, height: 10 },
    ])).toBe("Software");
  });

  it("preserves explicit and geometric line breaks", () => {
    expect(joinPdfTextItems([
      { str: "First line", transform: [10, 0, 0, 10, 10, 100], width: 40, height: 10, hasEOL: true },
      { str: "Second line", transform: [10, 0, 0, 10, 10, 85], width: 50, height: 10 },
    ])).toBe("First line\nSecond line");
  });
});
