"use client";

import { useState, useTransition } from "react";
import { scoreResumeAction } from "@/app/actions/ai";
import type { ParsedJob } from "@/lib/db/types";

function scoreColor(score: number) {
  if (score >= 70) return "#16a34a";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

export function JobAnalysisCard({
  applicationId,
  hasResume,
  job,
}: {
  applicationId: string;
  hasResume: boolean;
  job: ParsedJob;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [gaps, setGaps] = useState<string[]>([]);
  const [scoring, startScore] = useTransition();

  function runScore() {
    if (!hasResume) return;
    const fd = new FormData();
    fd.set("application_id", applicationId);
    startScore(async () => {
      const res = await scoreResumeAction(undefined, fd);
      if (res && "result" in res && res.result) {
        setScore(res.result.score);
        setGaps(res.result.gaps.slice(0, 3));
      }
    });
  }

  const keySkills = (job.key_skills?.length ? job.key_skills : job.required_skills ?? []).slice(0, 5);
  const verdict = job.verdict ?? job.role_summary ?? null;
  const color = score !== null ? scoreColor(score) : null;

  return (
    <div className="mt-8 flex items-start gap-5 rounded-md border border-border bg-muted/40 p-5 shadow-sm">
      <div className="shrink-0 flex flex-col items-center gap-1">
        {scoring ? (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-border">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent" />
          </div>
        ) : score !== null && color ? (
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-bold"
            style={{ borderColor: color, color }}
          >
            {score}
          </div>
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-border text-sm text-muted-foreground">
            --
          </div>
        )}
        <span className="text-[10px] text-muted-foreground">match</span>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        {keySkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {keySkills.map((s) => (
              <span
                key={s}
                className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {gaps.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {gaps.map((g) => (
              <span
                key={g}
                className="rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {verdict && (
          <p className="text-xs text-muted-foreground leading-relaxed">{verdict}</p>
        )}

        {hasResume && score === null && (
          <button
            type="button"
            onClick={runScore}
            disabled={scoring}
            className="w-fit rounded-sm border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
          >
            Score match
          </button>
        )}
      </div>
    </div>
  );
}
