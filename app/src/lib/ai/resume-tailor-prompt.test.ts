import { describe, expect, it } from "vitest";
import { RESUME_TAILOR_SYSTEM_PROMPT } from "./resume-tailor-prompt";

describe("resume tailoring prompt", () => {
  it("prioritizes the source format and compact one-line bullets", () => {
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "The uploaded resume is the sole formatting authority",
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      'For every candidate whose "kind" is "bullet"',
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "one compact, scannable bullet containing one main",
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "do not redesign the document",
    );
  });
});
