import { describe, expect, it } from "vitest";
import { formatResumeEvidence, selectResumeEvidence } from "./evidence";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";

const resume: ParsedResume = {
  experience: [
    {
      company: "BrightApps",
      title: "AI Product Intern",
      bullets: [
        "Built a prompt evaluation dashboard for support-ticket summarization.",
        "Added Zod validation for LLM JSON outputs.",
      ],
    },
    {
      company: "Campus Cafe",
      title: "Barista",
      bullets: ["Handled customer orders during morning shifts."],
    },
  ],
  projects: [
    {
      name: "HireFlow Assistant",
      bullets: ["Built a Next.js and Supabase app for resume parsing."],
    },
  ],
  skills: ["TypeScript", "React", "Supabase", "Latte art"],
};

const job: ParsedJob = {
  role_title: "AI Engineering Intern",
  required_skills: ["TypeScript", "React", "LLM evaluation", "Supabase"],
  responsibilities: ["Build prompt evaluation workflows and schema validation."],
};

describe("selectResumeEvidence", () => {
  it("ranks resume evidence by overlap with job requirements", () => {
    const evidence = selectResumeEvidence({ resume, job, limit: 5 });

    expect(evidence[0]).toEqual(
      expect.objectContaining({
        source: "experience",
        label: "AI Product Intern at BrightApps",
      }),
    );
    expect(evidence.map((item) => item.label)).toContain("TypeScript");
    expect(evidence.map((item) => item.label)).not.toContain("Latte art");
  });

  it("formats matched evidence for prompt context", () => {
    const evidence = selectResumeEvidence({ resume, job, limit: 1 });
    expect(formatResumeEvidence(evidence)).toContain("[experience]");
    expect(formatResumeEvidence([])).toContain("No high-confidence");
  });
});
