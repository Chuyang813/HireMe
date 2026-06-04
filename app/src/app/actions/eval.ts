"use server";

import { requireUser } from "@/lib/auth/current-user";
import { resumeToText, jobToText } from "@/lib/ai/evidence";
import { calculateATSScore, type ATSResult } from "@/lib/ai/ats-score";
import { checkFabrication, type FabricationResult } from "@/lib/ai/fabrication-check";
import { uuidSchema } from "@/lib/security/limits";
import type { ParsedJob, ParsedResume } from "@/lib/db/types";


export async function runResumeEvals(
  applicationId: string,
  generatedResume: string,
): Promise<{ ats: ATSResult; fabrication: FabricationResult }> {
  if (!uuidSchema.safeParse(applicationId).success) {
    throw new Error("Invalid application ID.");
  }

  const { supabase, user } = await requireUser();

  const [{ data: app }, { data: resumeRow }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("parsed_job_json, raw_job_text")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("base_resumes")
      .select("parsed_resume_json")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .single(),
  ]);

  if (!app) throw new Error("Application not found.");

  const parsedJob = app.parsed_job_json as ParsedJob | null;
  const parsedResume = (resumeRow?.parsed_resume_json as ParsedResume | null) ?? {};

  const jobDescription = app.raw_job_text ?? (parsedJob ? jobToText(parsedJob) : "");
  const sourceResumeText = resumeToText(parsedResume);

  const [ats, fabrication] = await Promise.all([
    Promise.resolve(calculateATSScore(generatedResume, jobDescription)),
    checkFabrication(generatedResume, sourceResumeText, jobDescription),
  ]);

  await supabase
    .from("job_applications")
    .update({ ats_score: ats.overall })
    .eq("id", applicationId)
    .eq("user_id", user.id);

  return { ats, fabrication };
}
