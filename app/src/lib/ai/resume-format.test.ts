import { describe, expect, it } from "vitest";
import {
  applyResumeReplacements,
  createResumeFormatTemplate,
  diffResumeReplacements,
  extractResumeHeader,
  hasUsableResumeLineStructure,
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
      { id: "L0006", text: "Built a reusable design system used across four product teams." },
      { id: "L0007", text: "Led user research and shipped a faster onboarding experience." },
    ]);
  });

  it("keeps line endings, indentation, bullets, blank lines, and headings unchanged", () => {
    const result = applyResumeReplacements(source, {
      L0006: "• Built a reusable design system aligned with product operations.",
      L0007: "Led research for a faster role-specific onboarding experience.",
      L0004: "WORK HISTORY",
      L9999: "Injected line",
    });

    const before = source.split("\r\n");
    const after = result.split("\r\n");
    expect(after).toHaveLength(before.length);
    expect(after[3]).toBe("EXPERIENCE");
    expect(after[5]).toBe("  • Built a reusable design system aligned with product operations.");
    expect(after[6]).toBe("  • Led research for a faster role-specific onboarding experience.");
    expect(after[7]).toBe("");
  });

  it("recognizes the LibreOffice private-use bullet found in uploaded PDFs", () => {
    const libreOfficeSource = source.replaceAll("•", "\uf0b7");
    const candidates = createResumeFormatTemplate(libreOfficeSource).candidates;
    expect(candidates).toHaveLength(2);
    expect(candidates[0].text).toBe(
      "Built a reusable design system used across four product teams.",
    );
  });

  it("derives only the changed source lines for format-preserving document edits", () => {
    const tailored = applyResumeReplacements(source, {
      L0006: "Built a role-specific design system without changing the document layout.",
    });
    expect(diffResumeReplacements(source, tailored)).toEqual([{
      id: "L0006",
      originalText: "Built a reusable design system used across four product teams.",
      replacementText: "Built a role-specific design system without changing the document layout.",
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
