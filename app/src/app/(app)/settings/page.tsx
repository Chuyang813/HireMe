import { requireUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/db/types";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Settings");

  const { data } = await supabase
    .from("profiles")
    .select("full_name, display_name")
    .eq("id", user.id)
    .single();

  const profile = data as Pick<Profile, "full_name" | "display_name"> | null;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-12">
      <div className="label-caps mb-2">{t("eyebrow")}</div>
      <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
      <SettingsClient
        user={{ email: user.email ?? "" }}
        profile={profile}
      />
    </div>
  );
}
