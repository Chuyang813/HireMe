import { requireUser } from "@/lib/auth/current-user";
import { UploadForm } from "./UploadForm";
import { deleteResumeAction, setDefaultResumeAction } from "./actions";
import type { BaseResume } from "@/lib/db/types";

export const metadata = { title: "Resumes" };

export default async function ResumesPage() {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("base_resumes")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const resumes: BaseResume[] = (data ?? []) as BaseResume[];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="label-caps mb-2">Dossier</div>
      <h1 className="font-display text-4xl leading-tight">Base resumes</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Upload the source resumes HireMe will tailor from. Your default is used
        automatically for new applications.
      </p>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-sm border border-border bg-muted/40 p-6">
          <h2 className="label-caps mb-4">New upload</h2>
          <UploadForm />
        </section>

        <section>
          <h2 className="label-caps mb-4">On file · {resumes.length}</h2>
          {resumes.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border p-8 text-sm text-muted-foreground">
              No resumes yet. Upload one to get started.
            </div>
          ) : (
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
                            Default
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {r.source_file_type?.toUpperCase() ?? "TEXT"} ·{" "}
                        uploaded {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!r.is_default ? (
                        <form action={setDefaultResumeAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button
                            type="submit"
                            className="rounded-sm border border-border px-3 py-1.5 text-xs hover:bg-muted"
                          >
                            Set default
                          </button>
                        </form>
                      ) : null}
                      <form action={deleteResumeAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-sm border border-border px-3 py-1.5 text-xs text-danger hover:bg-muted"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                  {r.parsed_resume_json ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Structured:{" "}
                      {[
                        r.parsed_resume_json.experience?.length &&
                          `${r.parsed_resume_json.experience.length} role${r.parsed_resume_json.experience.length === 1 ? "" : "s"}`,
                        r.parsed_resume_json.education?.length &&
                          `${r.parsed_resume_json.education.length} edu`,
                        r.parsed_resume_json.skills?.length &&
                          `${r.parsed_resume_json.skills.length} skills`,
                      ]
                        .filter(Boolean)
                        .join(" · ") || "text only"}
                    </p>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground italic">
                      Text captured — structured parse unavailable.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
