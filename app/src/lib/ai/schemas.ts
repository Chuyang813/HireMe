import { z } from "zod";
import type {
  AssessmentAnalysis,
  InterviewPrep,
  ParsedJob,
} from "@/lib/db/types";

export const parsedJobSchema = z.object({
  company_name: z.string().optional(),
  role_title: z.string().optional(),
  location: z.string().optional(),
  employment_type: z.string().optional(),
  role_summary: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  required_skills: z.array(z.string()).optional(),
  desired_skills: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  application_method: z.enum(["website", "email", "unknown"]).optional(),
  application_email: z.string().optional(),
  application_url: z.string().optional(),
  cover_letter_requested: z.boolean().optional(),
  deadline: z.string().optional(),
  key_skills: z.array(z.string()).optional(),
  verdict: z.string().optional(),
}) satisfies z.ZodType<ParsedJob>;

export const assessmentAnalysisSchema = z.object({
  summary: z.string(),
  deliverables: z.array(z.string()),
  evaluation_criteria: z.array(z.string()),
  preparation_steps: z.array(z.string()),
  checklist: z.array(z.string()),
  estimated_effort_hours: z.number().optional(),
}) satisfies z.ZodType<AssessmentAnalysis>;

export const interviewPrepSchema = z.object({
  likely_questions: z.array(
    z.object({
      question: z.string(),
      category: z.enum(["behavioral", "technical", "role_specific", "company"]),
      rationale: z.string().optional(),
      star_answer: z.string().optional(),
    }),
  ),
  preparation_checklist: z.array(z.string()),
  talking_points: z.array(z.string()),
}) satisfies z.ZodType<InterviewPrep>;
