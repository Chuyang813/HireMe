import { requireUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "./UploadForm";
import { deleteResumeAction, setDefaultResumeAction } from "./actions";
import type { BaseResume } from "@/lib/db/types";
import { ResumePreviewButton } from "@/components/ResumePreviewButton";
import { DEMO_RESUME_TITLE, isDemoUser } from "@/lib/demo";
import { DemoExampleNotice } from "@/components/DemoNotices";

export const metadata = { title: "Resumes" };

export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; needResume?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Resumes");
  const demoT = await getTranslations("Demo");
  const isDemo = isDemoUser(user);
  const params = await searchParams;
  const { data } = await supabase
    .from("base_resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const resumes: BaseResume[] = (data ?? []) as BaseResume[];
  const isWelcome = params.welcome === "1";
  const needsResume = params.needResume === "1";

  // First-time / gate banner
  const showBanner = isWelcome || needsResume;

  // No resumes yet — hero layout
  if (resumes.length === 0) {
    return (
      <div className="app-page">
        <div className="app-page-container app-page-container-narrow">
          <div className="app-page-header rise-enter">
            <div className="label-caps mb-2">{t("dossierLabel")}</div>
            <h1 className="app-page-title">{t("heroHeading")}</h1>
            <p className="app-page-subtitle">
              {isWelcome ? t("heroBodyWelcome") : t("heroBodyDefault")}
            </p>
          </div>

          {needsResume && (
            <div className="surface-card mt-6 flex items-start gap-3 border-[var(--warning-border)] bg-[var(--warning-light)] px-4 py-3 rise-enter [transition-delay:40ms]">
              <span className="mt-0.5 shrink-0 text-[var(--warning)]">⚠</span>
              <p className="text-sm text-[var(--warning)]">{t("needResumeWarning")}</p>
            </div>
          )}

          <div className="surface-card app-page-content p-6 rise-enter [transition-delay:80ms] sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
            <h2 className="text-center font-display text-xl leading-tight">{t("newUpload")}</h2>
            <div className="mt-6 rounded-lg border border-border bg-canvas p-5 text-left">
            <UploadForm />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-page">
      <div className="app-page-container">
        <div className="app-page-header rise-enter">
          <div className="label-caps mb-2">{t("dossierLabel")}</div>
          <h1 className="app-page-title">{t("heading")}</h1>
          <p className="app-page-subtitle">{t("headingSub")}</p>
        </div>

        {isDemo ? (
          <div className="mt-6 rise-enter [transition-delay:20ms]">
            <DemoExampleNotice title={demoT("resumesTitle")}>
              {demoT("resumesBody")}
            </DemoExampleNotice>
          </div>
        ) : null}

      {showBanner && (
        <div className="surface-card mt-6 flex items-start gap-3 border-[var(--success-border)] bg-[var(--success-light)] px-4 py-3 rise-enter [transition-delay:40ms]">
          <span className="mt-0.5 shrink-0 text-[var(--success)]">✓</span>
          <p className="text-sm text-[var(--success)]">
            {isWelcome ? t("welcomeBanner") : t("needResumeBanner")}
          </p>
        </div>
      )}

        <div className="app-page-content grid gap-6 rise-enter [transition-delay:80ms] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="surface-card p-5 sm:p-6">
          <h2 className="label-caps mb-4">{t("newUpload")}</h2>
          <UploadForm />
        </section>

        <section className="surface-card p-5 sm:p-6">
          <h2 className="label-caps mb-4">{t("onFile", { count: resumes.length })}</h2>
          <ul className="flex flex-col gap-3">
            {resumes.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-border bg-canvas p-4"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl">{r.title}</h3>
                      {r.is_default ? (
                        <span className="label-caps rounded-md border border-accent/20 bg-[var(--accent-light)] px-2 py-0.5 text-accent">
                          {t("defaultBadge")}
                        </span>
                      ) : null}
                      {isDemo && r.title === DEMO_RESUME_TITLE ? (
                        <span className="label-caps rounded-md border border-border bg-background px-2 py-0.5 text-muted-foreground">
                          {demoT("exampleBadge")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {r.source_file_type?.toUpperCase() ?? "TEXT"} ·{" "}
                      {t("uploadedOn")} {new Date(r.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ResumePreviewButton resumeId={r.id} title={r.title} />
                    {!r.is_default ? (
                      <form action={setDefaultResumeAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="btn btn-secondary btn-sm"
                        >
                          {t("setDefault")}
                        </button>
                      </form>
                    ) : null}
                    <form action={deleteResumeAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <button
                        type="submit"
                        className="btn btn-danger btn-sm"
                      >
                        {t("delete")}
                      </button>
                    </form>
                  </div>
                </div>
                {r.parsed_resume_json ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {t("structuredPrefix")}{" "}
                    {[
                      r.parsed_resume_json.experience?.length &&
                        t("roleCount", { count: r.parsed_resume_json.experience.length }),
                      r.parsed_resume_json.education?.length &&
                        t("eduCount", { count: r.parsed_resume_json.education.length }),
                      r.parsed_resume_json.skills?.length &&
                        t("skillsCount", { count: r.parsed_resume_json.skills.length }),
                    ]
                      .filter(Boolean)
                      .join(" · ") || t("textOnly")}
                  </p>
                ) : (
                  <p className="mt-3 text-xs text-muted-foreground italic">
                    {t("textCaptured")}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
        </div>
      </div>
    </div>
  );
}
