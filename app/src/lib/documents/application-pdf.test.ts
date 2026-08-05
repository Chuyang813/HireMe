import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createApplicationPdf,
  isResumeSectionHeading,
  splitSkillRow,
  splitDocumentHeader,
} from "./application-pdf";

const source = [
  "Chuyang Li 647-555-0100 | chuyang@example.com | Toronto, ON",
  "",
  "PROFESSIONAL SUMMARY",
  "IT support professional with experience supporting end users and business systems.",
  "",
  "PROFESSIONAL EXPERIENCE",
  "IT Support Analyst | Example Company | 2023 - Present",
  "• Resolved hardware, software, and account issues across Windows environments.",
  "",
  "EDUCATION",
  "Diploma in Information Technology",
].join("\n");

const fontFiles: Record<string, string> = {
  regular: "400Regular/Caladea_400Regular.ttf",
  italic: "400Regular_Italic/Caladea_400Regular_Italic.ttf",
  bold: "700Bold/Caladea_700Bold.ttf",
  boldItalic: "700Bold_Italic/Caladea_700Bold_Italic.ttf",
};

describe("application PDF layout", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input), "http://localhost");
      const variant = url.searchParams.get("variant") ?? "regular";
      const relativePath = fontFiles[variant];
      if (!relativePath) return new Response(null, { status: 404 });
      const font = await readFile(path.join(
        process.cwd(),
        "node_modules",
        "@expo-google-fonts",
        "caladea",
        relativePath,
      ));
      return new Response(font, { headers: { "Content-Type": "font/ttf" } });
    }));
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("separates the source contact header from the resume body", () => {
    expect(splitDocumentHeader(source)).toEqual({
      headerLines: ["Chuyang Li 647-555-0100 | chuyang@example.com | Toronto, ON"],
      bodyLines: source.split("\n").slice(2),
    });
    expect(isResumeSectionHeading("PROFESSIONAL EXPERIENCE")).toBe(true);
    expect(isResumeSectionHeading("IT Support Analyst | Example Company | 2023 - Present")).toBe(false);
  });

  it("recognizes labeled skill category rows", () => {
    expect(splitSkillRow(
      "Frameworks, APIs & Databases: FastAPI, PostgreSQL, Supabase",
    )).toEqual([
      "Frameworks, APIs & Databases:",
      "FastAPI, PostgreSQL, Supabase",
    ]);
  });

  it("creates an embedded-font Letter PDF for the on-page preview", async () => {
    const blob = await createApplicationPdf(source, "tailored_resume", "Tailored resume");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    expect(bytes.length).toBeGreaterThan(10_000);
  });
});
