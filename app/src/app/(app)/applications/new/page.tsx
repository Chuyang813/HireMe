import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { NewApplicationForm } from "./NewApplicationForm";

export const metadata = { title: "New application" };

export default async function NewApplicationPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Applications");
  const { data: defaultResume } = await supabase
    .from("base_resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();

  if (!defaultResume) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="label-caps mb-2">{t("newPageLabel")}</div>
      <h1 className="font-display text-4xl leading-tight">{t("newPageHeading")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("newPageSub")}</p>
      <div className="mt-10">
        <NewApplicationForm />
      </div>
    </div>
  );
}
