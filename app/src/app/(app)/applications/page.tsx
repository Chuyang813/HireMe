import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import type { JobApplication } from "@/lib/db/types";
import { ApplicationsView } from "./ApplicationsView";

export const metadata = { title: "Applications" };

export default async function ApplicationsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Applications");

  const [{ data }, { count: resumeCount }] = await Promise.all([
    supabase
      .from("job_applications")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("base_resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const applications: JobApplication[] = (data ?? []) as JobApplication[];
  const hasResume = (resumeCount ?? 0) > 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-6 sm:py-12">
      <div className="label-caps mb-2">{t("dossierLabel")}</div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-xl leading-tight sm:text-4xl">{t("heading")}</h1>
        <Link
          href="/applications/new"
          className="inline-flex h-9 items-center rounded-md bg-accent px-4 text-[13px] font-medium text-accent-foreground hover:bg-[var(--accent-hover)]"
        >
          {t("newApplication")}
        </Link>
      </div>

      <ApplicationsView applications={applications} hasResume={hasResume} />
    </div>
  );
}
