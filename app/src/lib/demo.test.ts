import { describe, expect, it } from "vitest";
import {
  DEMO_APPLICATION_LIMIT,
  DEMO_RESUME_PARSED,
  DEMO_RESUME_TEXT,
  demoApplicationRemaining,
  demoDocumentRemaining,
  isDemoUser,
  type DemoUsage,
} from "@/lib/demo";

const emptyUsage: DemoUsage = {
  applications: 0,
  documents: {
    tailored_resume: 0,
    cover_letter: 0,
    email_draft: 0,
    interview_prep: 0,
  },
};

describe("demo session rules", () => {
  it("recognizes anonymous and metadata-tagged demo users", () => {
    expect(isDemoUser({ is_anonymous: true, user_metadata: {}, app_metadata: {} })).toBe(true);
    expect(
      isDemoUser({ is_anonymous: false, user_metadata: {}, app_metadata: { is_demo: true } }),
    ).toBe(true);
    expect(
      isDemoUser({ is_anonymous: false, user_metadata: { is_demo: true }, app_metadata: {} }),
    ).toBe(true);
    expect(isDemoUser({ is_anonymous: false, user_metadata: {}, app_metadata: {} })).toBe(false);
  });

  it("clamps application and document allowances at zero", () => {
    expect(demoApplicationRemaining(emptyUsage)).toBe(DEMO_APPLICATION_LIMIT);
    expect(
      demoApplicationRemaining({ ...emptyUsage, applications: DEMO_APPLICATION_LIMIT + 1 }),
    ).toBe(0);
    expect(demoDocumentRemaining(emptyUsage, "cover_letter")).toBe(1);
    expect(
      demoDocumentRemaining(
        { ...emptyUsage, documents: { ...emptyUsage.documents, cover_letter: 2 } },
        "cover_letter",
      ),
    ).toBe(0);
  });

  it("ships a structured example resume with readable section breaks", () => {
    expect(DEMO_RESUME_PARSED.name).toBe("Maya Patel");
    expect(DEMO_RESUME_PARSED.education).toHaveLength(2);
    expect(DEMO_RESUME_PARSED.skills?.every((line) => line.includes(":"))).toBe(true);
    expect(DEMO_RESUME_TEXT).toContain("\nEDUCATION\n");
    expect(DEMO_RESUME_TEXT).toContain("\nSKILLS\n-");
    expect(DEMO_RESUME_TEXT).not.toContain("University of Toronto");
    expect(DEMO_RESUME_TEXT).not.toContain("Queen's University");
    expect(DEMO_RESUME_TEXT).not.toContain("Electrical and Computer Engineering");
  });
});
