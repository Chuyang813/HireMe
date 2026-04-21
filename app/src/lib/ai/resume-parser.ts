import { claudeJson } from "./anthropic";
import type { ParsedResume } from "@/lib/db/types";

const SYSTEM = `You are a resume parsing assistant.

Given the raw text of a resume, extract a structured JSON object following this TypeScript type:

type ParsedResume = {
  name?: string;
  contact?: { email?: string; phone?: string; location?: string; links?: string[] };
  summary?: string;
  education?: Array<{ school?: string; degree?: string; field?: string; start?: string; end?: string; notes?: string }>;
  experience?: Array<{ company?: string; title?: string; location?: string; start?: string; end?: string; bullets?: string[] }>;
  projects?: Array<{ name?: string; description?: string; bullets?: string[]; links?: string[] }>;
  skills?: string[];
  certifications?: string[];
  languages?: string[];
};

Rules:
- Only include information explicitly present in the text. Never invent employers, schools, dates, or accomplishments.
- Preserve the user's wording for bullets; do not rewrite.
- Output a single JSON object, no prose, no code fences.`;

export async function parseResume(rawText: string): Promise<ParsedResume> {
  return claudeJson<ParsedResume>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Resume text:\n\n${rawText}\n\nReturn the ParsedResume JSON.`,
      },
    ],
    maxTokens: 4096,
  });
}
