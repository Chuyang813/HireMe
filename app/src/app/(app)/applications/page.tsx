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
    <div className="app-page">
      <div className="app-page-container">
        <div className="app-page-header rise-enter">
          <div className="label-caps mb-2">{t("dossierLabel")}</div>
          <h1 className="app-page-title">{t("heading")}</h1>
          <p className="app-page-subtitle">{t("headingSub")}</p>
          <Link href="/applications/new" className="btn btn-primary mt-6">
            {t("newApplication")}
          </Link>
        </div>

        <div className="app-page-content rise-enter [transition-delay:40ms]">
          <ApplicationsView applications={applications} hasResume={hasResume} />
        </div>
      </div>
    </div>
  );
}
