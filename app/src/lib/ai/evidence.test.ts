import { describe, expect, it } from "vitest";
import {
  formatResumeEvidence,
  groupResumeSkills,
  resumeToText,
  selectResumeEvidence,
} from "./evidence";
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

  it("renders parsed experience and project content as separate bullet lines", () => {
    const text = resumeToText(resume);

    expect(text).toContain(
      "AI Product Intern | BrightApps\n- Built a prompt evaluation dashboard for support-ticket summarization.\n- Added Zod validation for LLM JSON outputs.",
    );
    expect(text).toContain(
      "HireFlow Assistant\n- Built a Next.js and Supabase app for resume parsing.",
    );
  });

  it("renders each education field on its own compact line", () => {
    const text = resumeToText({
      ...resume,
      education: [{
        degree: "Master of Engineering",
        field: "Electrical & Computer Engineering",
        school: "University of Toronto",
        start: "2024",
        end: "Mar 2026",
        notes: "Emphasis in Data Analytics and Machine Learning",
      }],
    });

    expect(text).toContain([
      "EDUCATION",
      "Master of Engineering | Electrical & Computer Engineering",
      "University of Toronto",
      "2024 - Mar 2026",
      "Emphasis in Data Analytics and Machine Learning",
    ].join("\n"));
  });

  it("groups skills into labeled rows without dropping uncategorized skills", () => {
    expect(groupResumeSkills(resume.skills ?? [])).toEqual([
      { label: "Languages & Fundamentals", skills: ["TypeScript"] },
      { label: "Frameworks, APIs & Databases", skills: ["React", "Supabase"] },
      { label: "Additional Skills", skills: ["Latte art"] },
    ]);
    expect(resumeToText(resume)).toContain([
      "SKILLS",
      "Languages & Fundamentals: TypeScript",
      "Frameworks, APIs & Databases: React, Supabase",
      "Additional Skills: Latte art",
    ].join("\n"));
  });
});
