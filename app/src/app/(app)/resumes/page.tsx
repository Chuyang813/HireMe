import { requireUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";
import { UploadForm } from "./UploadForm";
import { deleteResumeAction, setDefaultResumeAction } from "./actions";
import type { BaseResume } from "@/lib/db/types";
import { ResumePreviewButton } from "@/components/ResumePreviewButton";

export const metadata = { title: "Resumes" };

export default async function ResumesPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; needResume?: string }>;
}) {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Resumes");
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
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <div className="label-caps mb-2">{t("dossierLabel")}</div>

        {needsResume && (
          <div className="mb-6 flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <span className="mt-0.5 shrink-0 text-amber-500">⚠</span>
            <p className="text-sm text-amber-800">
              {t("needResumeWarning")}
            </p>
          </div>
        )}

        <div className="rounded-md border border-border bg-white p-10 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="12" x2="12" y2="18" />
              <line x1="9" y1="15" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="font-display text-3xl leading-tight">{t("heroHeading")}</h1>
          <p className="mt-3 text-sm text-muted-foreground max-w-sm mx-auto">
            {isWelcome ? t("heroBodyWelcome") : t("heroBodyDefault")}
          </p>

          <div className="mt-8 text-left rounded-sm border border-border bg-muted/40 p-6">
            <h2 className="label-caps mb-4">{t("newUpload")}</h2>
            <UploadForm />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="label-caps mb-2">{t("dossierLabel")}</div>
      <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("headingSub")}
      </p>

      {showBanner && (
        <div className="mt-6 flex items-start gap-3 rounded-md border border-green-300 bg-green-50 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-green-600">✓</span>
          <p className="text-sm text-green-800">
            {isWelcome ? t("welcomeBanner") : t("needResumeBanner")}
          </p>
        </div>
      )}

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-sm border border-border bg-muted/40 p-6">
          <h2 className="label-caps mb-4">{t("newUpload")}</h2>
          <UploadForm />
        </section>

        <section>
          <h2 className="label-caps mb-4">{t("onFile", { count: resumes.length })}</h2>
          <ul className="flex flex-col gap-3">
            {resumes.map((r) => (
              <li
                key={r.id}
                className="rounded-sm border border-border bg-background p-5"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-xl">{r.title}</h3>
                      {r.is_default ? (
                        <span className="label-caps rounded-sm border border-border px-1.5 py-0.5">
                          {t("defaultBadge")}
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
  );
}
