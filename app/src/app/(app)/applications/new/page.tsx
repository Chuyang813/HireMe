import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { NewApplicationForm } from "./NewApplicationForm";
import {
  DEMO_APPLICATION_LIMIT,
  getDemoUsage,
  isDemoUser,
} from "@/lib/demo";
import { DemoUsageBanner } from "@/components/DemoNotices";

export const metadata = { title: "New application" };

export default async function NewApplicationPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Applications");
  const { data: resumes } = await supabase
    .from("base_resumes")
    .select("id, title, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (!resumes?.length) {
    redirect("/onboarding");
  }
  const defaultResumeId = resumes.find((resume) => resume.is_default)?.id ?? resumes[0].id;

  const demoUsage = isDemoUser(user) ? await getDemoUsage(supabase, user.id) : null;
  const demoLimitReached =
    demoUsage != null && demoUsage.applications >= DEMO_APPLICATION_LIMIT;

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas">
      <div className="mx-auto w-full max-w-3xl px-6 py-12">
        <div className="rise-enter text-center">
          <div className="label-caps mb-2">{t("newPageLabel")}</div>
          <h1 className="font-display text-4xl leading-tight tracking-tight">
            {t("newPageHeading")}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            {t("newPageSub")}
          </p>
        </div>
        {demoUsage ? (
          <div className="mt-8 rise-enter [transition-delay:20ms]">
            <DemoUsageBanner usage={demoUsage} />
          </div>
        ) : null}
        <div className="mt-10">
          <NewApplicationForm
            demoLimitReached={demoLimitReached}
            resumes={resumes.map((resume) => ({ id: resume.id, title: resume.title }))}
            defaultResumeId={defaultResumeId}
          />
        </div>
      </div>
    </div>
  );
}
