import { aiJson } from "./provider";
import { parsedJobSchema } from "./schemas";
import type { ParsedJob } from "@/lib/db/types";

const SYSTEM = `You are a job posting parsing assistant.

Extract a structured JSON object from the raw job posting. Follow this TypeScript type:

type ParsedJob = {
  company_name?: string;
  role_title?: string;
  location?: string;
  employment_type?: string;
  role_summary?: string;
  responsibilities?: string[];
  required_skills?: string[];
  desired_skills?: string[];
  keywords?: string[];
  application_method?: "website" | "email" | "unknown";
  application_email?: string;
  application_url?: string;
  cover_letter_requested?: boolean;
  deadline?: string;
  key_skills?: string[];   // top 5 must-have skills, ordered by importance
  verdict?: string;        // ONE sentence: what makes this role distinctive or the bar to clear
};

Rules:
- Only include information explicitly present in the posting.
- Distinguish required vs desired skills when the posting separates them.
- key_skills: pick the 5 most critical technical/domain skills from required_skills. Omit soft skills.
- verdict: one sentence, max 15 words. State the defining requirement or standout trait of this role.
- application_method must be "email" if the posting asks the user to email their application, otherwise "website" if a portal is referenced, else "unknown".
- Output a single JSON object, no prose, no code fences.`;

export async function parseJobPosting(rawText: string): Promise<ParsedJob> {
  const raw = await aiJson<ParsedJob>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Job posting:\n\n${rawText}\n\nReturn the ParsedJob JSON.`,
      },
    ],
    maxTokens: 2048,
  });
  const validated = parsedJobSchema.safeParse(stripNulls(raw));
  if (!validated.success) {
    console.error("[parseJobPosting] Schema validation failed:", validated.error);
    return raw; // best-effort: return raw if schema doesn't match
  }
  return validated.data;
}

function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripNulls) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== null)
        .map(([key, entry]) => [key, stripNulls(entry)]),
    ) as T;
  }

  return value;
}
