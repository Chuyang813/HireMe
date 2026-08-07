import { describe, expect, it } from "vitest";
import {
  restoreInlineBulletPrefix,
  sourceDocumentHasBytes,
  sourceDocumentLoadErrorMessage,
  sourceTextMatchScore,
} from "./source-document";

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

  it("rejects an empty source file before PDF or DOCX parsing", () => {
    expect(sourceDocumentHasBytes(new ArrayBuffer(0))).toBe(false);
    expect(sourceDocumentHasBytes(new ArrayBuffer(1))).toBe(true);
  });

  it("surfaces a document/PDF error returned by the protected source route", async () => {
    await expect(sourceDocumentLoadErrorMessage(Response.json(
      { error: "Could not load the uploaded document/PDF." },
      { status: 404 },
    ))).resolves.toBe("Could not load the uploaded document/PDF.");
  });

  it("uses a document/PDF fallback for non-JSON platform errors", async () => {
    await expect(sourceDocumentLoadErrorMessage(new Response("Not found", { status: 404 })))
      .resolves.toBe("Could not load the uploaded document/PDF.");
  });

  it("restores a bullet that shares a PDF text item with replaced content", () => {
    expect(restoreInlineBulletPrefix(
      "• Built a reusable design system.",
      "Built a role-specific design system.",
    )).toBe("• Built a role-specific design system.");
    expect(restoreInlineBulletPrefix(
      "1. Led product research.",
      "Led role-specific product research.",
    )).toBe("1. Led role-specific product research.");
  });
});
