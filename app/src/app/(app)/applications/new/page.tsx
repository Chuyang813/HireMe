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
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-[#0f0f0f]">
      {/* Ambient glow layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 h-96 w-[52rem] -translate-x-1/2 rounded-full bg-[#6366f1]/[0.13] blur-[120px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 right-[-10rem] h-96 w-96 rounded-full bg-[#8b5cf6]/[0.08] blur-[120px]"
      />

      <div className="relative mx-auto w-full max-w-3xl px-6 py-12">
        <div className="rise-enter text-center">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-white/35">
            {t("newPageLabel")}
          </div>
          <h1 className="font-display text-4xl leading-tight text-white">
            {t("newPageHeading")}
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/45">
            {t("newPageSub")}
          </p>
        </div>
        <div className="mt-10">
          <NewApplicationForm />
        </div>
      </div>
    </div>
  );
}
