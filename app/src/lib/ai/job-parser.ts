import { claudeJson } from "./anthropic";
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
};

Rules:
- Only include information explicitly present in the posting.
- Distinguish required vs desired skills when the posting separates them.
- application_method must be "email" if the posting asks the user to email their application, otherwise "website" if a portal is referenced, else "unknown".
- Output a single JSON object, no prose, no code fences.`;

export async function parseJobPosting(rawText: string): Promise<ParsedJob> {
  const raw = await claudeJson<ParsedJob>({
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Job posting:\n\n${rawText}\n\nReturn the ParsedJob JSON.`,
      },
    ],
    maxTokens: 2048,
  });
  const validated = parsedJobSchema.safeParse(raw);
  if (!validated.success) {
    console.error("[parseJobPosting] Schema validation failed:", validated.error);
    return raw; // best-effort: return raw if schema doesn't match
  }
  return validated.data;
}
