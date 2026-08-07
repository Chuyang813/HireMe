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
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "each education entry as separate program, school, and date lines",
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "Skills rows are editable only to prioritize JD-relevant skills",
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      'each experience or project line\'s "section" and optional "context" as a hard semantic boundary',
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      '"maxCharacters" value is a hard output limit',
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "JOB MATCHING",
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "Do not return an empty replacement map",
    );
    expect(RESUME_TAILOR_SYSTEM_PROMPT).toContain(
      "A named skill may be used in Summary or Skills only when it is present",
    );
  });
});
