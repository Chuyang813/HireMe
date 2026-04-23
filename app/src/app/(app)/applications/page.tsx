import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { APPLICATION_STATUS_LABEL } from "@/lib/db/types";
import type { JobApplication } from "@/lib/db/types";
import { DeleteApplicationButton } from "@/components/DeleteApplicationButton";

export const metadata = { title: "Applications" };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isStale(app: JobApplication): boolean {
  return (
    app.current_status === "saved" &&
    Date.now() - new Date(app.created_at).getTime() > ONE_DAY_MS
  );
}

export default async function ApplicationsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Applications");

  const { data } = await supabase
    .from("job_applications")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  const applications: JobApplication[] = (data ?? []) as JobApplication[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="label-caps mb-2">{t("dossierLabel")}</div>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
        <Link
          href="/applications/new"
          className="rounded-md bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 shadow-sm"
        >
          {t("newApplication")}
        </Link>
      </div>

      <div className="mt-10">
        {applications.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-12 text-center">
            <p className="font-display text-2xl text-muted-foreground">
              {t("noAppsHeading")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{t("noAppsSub")}</p>
            <Link
              href="/applications/new"
              className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-accent px-5 text-sm font-medium text-accent-foreground hover:opacity-90 shadow-sm"
            >
              {t("addApplication")}
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {applications.map((app) => (
              <li key={app.id} className="relative">
                <Link
                  href={`/applications/${app.id}`}
                  className="block rounded-md border border-border bg-white p-5 transition-colors hover:border-accent/50 shadow-sm"
                >
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
                    <div className="flex items-center gap-2 shrink-0">
                      {isStale(app) && (
                        <span
                          className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-[10px] font-medium text-yellow-700"
                          title="Saved over 1 day ago — did you apply?"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                          Update status
                        </span>
                      )}
                      <span className="label-caps whitespace-nowrap rounded-md border border-border px-1.5 py-0.5">
                        {APPLICATION_STATUS_LABEL[app.current_status]}
                      </span>
                      <DeleteApplicationButton applicationId={app.id} variant="icon" />
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t("updatedPrefix")} {new Date(app.updated_at).toLocaleDateString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
