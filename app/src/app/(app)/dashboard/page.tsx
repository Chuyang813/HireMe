import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import type { JobApplication, Profile } from "@/lib/db/types";
import { APPLICATION_STATUS_LABEL } from "@/lib/db/types";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Dashboard");

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_complete")
    .eq("id", user.id)
    .single();

  if (!(profile as Profile | null)?.onboarding_complete) {
    redirect("/onboarding");
  }
  const { data } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(10);

  const applications: JobApplication[] = (data ?? []) as JobApplication[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="label-caps mb-2">{t("overviewLabel")}</div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
        <span className="label-caps hidden sm:inline">{user.email}</span>
      </div>

      <div className="mt-10">
        <div className="flex items-baseline justify-between gap-4 mb-4">
          <h2 className="label-caps">
            {t("recentApplications", { count: applications.length })}
          </h2>
          <Link
            href="/applications/new"
            className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            {t("addApplication")}
          </Link>
        </div>

        {applications.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-12 text-center">
            <p className="font-display text-2xl text-muted-foreground">
              {t("noAppsHeading")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("noAppsSub")}</p>
            <Link
              href="/applications/new"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-sm bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              {t("addApplication")}
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((app) => (
              <li key={app.id} className="rounded-sm border border-border bg-background p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <h3 className="font-display text-xl">
                      {app.role_title ?? "Untitled role"}
                    </h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {app.company_name ?? "Unknown company"}
                      {app.location ? ` · ${app.location}` : ""}
                    </p>
                  </div>
                  <span className="label-caps whitespace-nowrap rounded-sm border border-border px-1.5 py-0.5">
                    {APPLICATION_STATUS_LABEL[app.current_status]}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("updatedPrefix")} {new Date(app.updated_at).toLocaleDateString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
