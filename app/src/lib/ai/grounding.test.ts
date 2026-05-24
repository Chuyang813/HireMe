import { describe, expect, it } from "vitest";
import { checkGeneratedDocumentGrounding } from "./grounding";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const resume: ParsedResume = {
  name: "Maya Chen",
  contact: {
    email: "maya@example.com",
    location: "Toronto, ON",
    links: ["github.com/mayachen"],
  },
  education: [{ school: "University of Waterloo", degree: "BSc Computer Science" }],
  experience: [
    {
      company: "BrightApps",
      title: "AI Product Intern",
      bullets: ["Added schema validation for LLM JSON outputs using Zod."],
    },
  ],
  skills: ["TypeScript", "React", "Zod"],
};

const job: ParsedJob = {
  company_name: "Northstar Labs",
  role_title: "Software Engineering Intern",
  required_skills: ["TypeScript", "React"],
};

describe("checkGeneratedDocumentGrounding", () => {
  it("does not warn for content grounded in source material", () => {
    const warnings = checkGeneratedDocumentGrounding({
      content:
        "Maya Chen used TypeScript and React at BrightApps and is applying to Northstar Labs.",
      documentType: "cover_letter",
      resume,
      job,
    });

    expect(warnings).toEqual([]);
  });

  it("flags unsupported emails, links, metrics, and named entities", () => {
    const warnings = checkGeneratedDocumentGrounding({
      content:
        "Maya Chen led work at Google, improved revenue by 45%, and can be reached at fake@example.com or https://fake.example.",
      documentType: "cover_letter",
      resume,
      job,
    });

    expect(warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "email", value: "fake@example.com" }),
        expect.objectContaining({ kind: "url", value: "https://fake.example" }),
        expect.objectContaining({ kind: "number", value: "45%" }),
        expect.objectContaining({ kind: "entity", value: "Google" }),
      ]),
    );
  });

  it("skips document types that are not generated from resume and job context", () => {
    const warnings = checkGeneratedDocumentGrounding({
      content: "Assessment requires a 2027 delivery timeline.",
      documentType: "assessment_notes",
      resume,
      job,
    });

    expect(warnings).toEqual([]);
  });
});
