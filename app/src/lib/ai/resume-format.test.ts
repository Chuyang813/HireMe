import { describe, expect, it } from "vitest";
import {
  applyResumeReplacements,
  applyValidatedResumeReplacements,
  bestResumeTailoring,
  createResumeFormatTemplate,
  diffResumeReplacements,
  extractResumeHeader,
  hasUsableResumeLineStructure,
  minimumResumeTailoringChanges,
  renderCoverLetterWithResumeFormat,
  stripAccidentalResumePrefixFromCoverLetter,
} from "./resume-format";

const source = [
  "Alex Chen",
  "alex@example.com | Toronto, ON",
  "",
  "EXPERIENCE",
  "Senior Designer | Acme | 2022 - Present",
  "  • Built a reusable design system used across four product teams.",
  "  • Led user research and shipped a faster onboarding experience.",
  "",
  "SKILLS",
  "Figma, prototyping, user research",
].join("\r\n");

describe("resume format preservation", () => {
  it("only exposes content lines while protecting the header and section structure", () => {
    const template = createResumeFormatTemplate(source);
    expect(template.candidates).toEqual([
      {
        id: "L0006",
        text: "Built a reusable design system used across four product teams.",
        kind: "bullet",
        section: "experience",
        context: "Senior Designer | Acme | 2022 - Present",
        maxCharacters: 62,
      },
      {
        id: "L0007",
        text: "Led user research and shipped a faster onboarding experience.",
        kind: "bullet",
        section: "experience",
        context: "Senior Designer | Acme | 2022 - Present",
        maxCharacters: 61,
      },
      {
        id: "L0010",
        text: "Figma, prototyping, user research",
        kind: "prose",
        section: "skills",
        maxCharacters: 33,
      },
    ]);
  });

  it("keeps line endings, indentation, bullets, blank lines, and headings unchanged", () => {
    const result = applyResumeReplacements(source, {
      L0006: "• Built reusable design patterns for product operations teams.",
      L0007: "Led research that improved the role-specific onboarding flow.",
      L0004: "WORK HISTORY",
      L9999: "Injected line",
    });

    const before = source.split("\r\n");
    const after = result.split("\r\n");
    expect(after).toHaveLength(before.length);
    expect(after[3]).toBe("EXPERIENCE");
    expect(after[5]).toBe("  • Built reusable design patterns for product operations teams.");
    expect(after[6]).toBe("  • Led research that improved the role-specific onboarding flow.");
    expect(after[7]).toBe("");
  });

  it("recognizes the LibreOffice private-use bullet found in uploaded PDFs", () => {
    const libreOfficeSource = source.replaceAll("•", "\uf0b7");
    const candidates = createResumeFormatTemplate(libreOfficeSource).candidates;
    expect(candidates).toHaveLength(3);
    expect(candidates[0].text).toBe(
      "Built a reusable design system used across four product teams.",
    );
  });

  it("keeps education immutable while exposing categorized skills for JD prioritization", () => {
    const protectedSource = [
      "Alex Chen",
      "alex@example.com | Toronto, ON",
      "",
      "EXPERIENCE",
      "  • Built a reusable design system used across four product teams.",
      "",
      "EDUCATION",
      "Master of Engineering | Electrical & Computer Engineering",
      "University of Toronto with a specialization in machine learning systems",
      "2024 - Mar 2026",
      "",
      "SKILLS",
      "Languages & Fundamentals: TypeScript, JavaScript, Python, algorithms and data structures",
    ].join("\n");

    expect(createResumeFormatTemplate(protectedSource).candidates).toEqual([
      {
        id: "L0005",
        text: "Built a reusable design system used across four product teams.",
        kind: "bullet",
        section: "experience",
        maxCharacters: 62,
      },
      {
        id: "L0013",
        text: "Languages & Fundamentals: TypeScript, JavaScript, Python, algorithms and data structures",
        kind: "prose",
        section: "skills",
        maxCharacters: 88,
      },
    ]);
  });

  it("reorders verified skills while preserving the exact category label", () => {
    const categorized = [
      "Alex Chen",
      "alex@example.com | Toronto, ON",
      "",
      "SKILLS",
      "Tools: Python, SQL, Docker",
    ].join("\n");

    expect(applyResumeReplacements(categorized, {
      L0005: "Tools: SQL, Docker, Python",
    })).toContain("Tools: SQL, Docker, Python");
    expect(applyResumeReplacements(categorized, {
      L0005: "Platforms: SQL, Docker",
    })).toBe(categorized);
    expect(applyResumeReplacements(categorized, {
      L0005: "Tools: Kubernetes, SQL",
    })).toBe(categorized);
  });

  it("allows a summary to foreground a skill verified elsewhere in the resume", () => {
    const withVerifiedSkill = [
      "Alex Chen",
      "alex@example.com | Toronto, ON",
      "",
      "SUMMARY",
      "Civil engineer experienced in municipal drainage design and detailed field reporting.",
      "",
      "SKILLS",
      "Engineering Tools: PCSWMM, AutoCAD, Excel",
    ].join("\n");

    expect(applyResumeReplacements(withVerifiedSkill, {
      L0005: "Civil engineer experienced in PCSWMM drainage design and detailed field reporting.",
    })).toContain("experienced in PCSWMM drainage design");
  });

  it("requires material changes in proportion to the available editable lines", () => {
    expect(minimumResumeTailoringChanges(0)).toBe(0);
    expect(minimumResumeTailoringChanges(3)).toBe(1);
    expect(minimumResumeTailoringChanges(4)).toBe(2);
    expect(minimumResumeTailoringChanges(10)).toBe(3);
  });

  it("never reports an unchanged source resume as successful tailoring", () => {
    expect(() => applyValidatedResumeReplacements(source, {}, 1)).toThrow(
      "did not produce enough supported changes",
    );
    expect(applyValidatedResumeReplacements(source, {
      L0006: "Built reusable design patterns for product operations teams.",
    }, 1)).not.toBe(source);
  });

  it("selects the candidate replacement map with the most accepted changes", () => {
    const best = bestResumeTailoring(source, [
      {},
      { L0006: "Built reusable design patterns for product operations teams." },
      {
        L0006: "Built reusable design patterns for product operations teams.",
        L0007: "Led research that improved role-specific onboarding flows.",
      },
    ]);

    expect(best.appliedChanges).toBe(2);
    expect(best.content).toContain("role-specific onboarding flows");
  });

  it("labels custom sections and rejects replacements that cannot fit the source line", () => {
    const customSource = [
      "Alex Chen",
      "alex@example.com | Toronto, ON",
      "",
      "SUMMARY OF QUALIFICATIONS",
      "Civil engineer experienced in municipal drainage design and field reporting.",
    ].join("\n");
    const [candidate] = createResumeFormatTemplate(customSource).candidates;

    expect(candidate).toEqual(expect.objectContaining({
      section: "summary of qualifications",
      maxCharacters: 76,
    }));
    expect(applyResumeReplacements(customSource, {
      L0005: "Civil engineer experienced in municipal drainage design, PCSWMM modelling, construction inspection, reporting, and project coordination.",
    })).toBe(customSource);
    expect(applyResumeReplacements(customSource, {
      L0005: "Civil engineer experienced in PCSWMM drainage design and field reporting.",
    })).toBe(customSource);
  });

  it("derives only the changed source lines for format-preserving document edits", () => {
    const tailored = applyResumeReplacements(source, {
      L0006: "Built a role-specific design system for product operations.",
    });
    expect(diffResumeReplacements(source, tailored)).toEqual([{
      id: "L0006",
      originalText: "Built a reusable design system used across four product teams.",
      replacementText: "Built a role-specific design system for product operations.",
    }]);
  });

  it("does not treat an unsegmented single-line resume as a header", () => {
    const collapsed =
      "Alex Chen alex@example.com | Toronto, ON PROFILE Senior designer with a decade "
      + "of experience shipping design systems, native apps, and web platforms across "
      + "four product teams and two continents.";
    expect(extractResumeHeader(collapsed)).toEqual([]);
    expect(hasUsableResumeLineStructure(collapsed)).toBe(false);
  });

  it("removes a legacy collapsed-resume prefix from a cover letter", () => {
    const collapsed = Array.from(
      { length: 30 },
      (_, index) => `Resume fact ${index + 1}`,
    ).join(" ");
    const brokenLetter = [
      collapsed,
      "",
      "July 19, 2026",
      "Acme Corp",
      "",
      "Dear Hiring Manager,",
      "I am applying for the role.",
    ].join("\n");

    const repaired = stripAccidentalResumePrefixFromCoverLetter(brokenLetter, collapsed);
    expect(repaired).toMatch(/^July 19, 2026/);
    expect(repaired).not.toContain("Resume fact 1 Resume fact 2");
  });

  it("reuses the exact resume header for cover letters", () => {
    expect(extractResumeHeader(source)).toEqual([
      "Alex Chen",
      "alex@example.com | Toronto, ON",
    ]);

    const letter = renderCoverLetterWithResumeFormat(source, {
      date: "July 18, 2026",
      recipient: ["Acme", "Toronto, ON"],
      subject: "Re: Senior Designer",
      greeting: "Dear Hiring Manager,",
      opening: "I build focused product systems.",
      sections: [{
        heading: "Reusable Product Systems",
        paragraph: "I developed a reusable design system across product teams.",
      }],
      finalParagraph: "I would welcome a conversation.",
      closing: "Sincerely,",
      signature: "Alex Chen",
    });

    expect(letter.startsWith("Alex Chen\r\nalex@example.com | Toronto, ON\r\n\r\n")).toBe(true);
    expect(letter).toContain("Re: Senior Designer\r\n\r\nDear Hiring Manager,");
    expect(letter).toContain(
      "Reusable Product Systems\r\n\r\nI developed a reusable design system across product teams.",
    );
    expect(letter).toContain("Sincerely,\r\nAlex Chen");
  });
});
