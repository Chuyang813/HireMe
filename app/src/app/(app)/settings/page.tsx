import { requireUser } from "@/lib/auth/current-user";
import { getTranslations } from "next-intl/server";
import type { Profile } from "@/lib/db/types";
import { SettingsClient } from "./SettingsClient";
import { isDemoUser } from "@/lib/demo";

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
    <div className="app-page">
      <div className="app-page-container app-page-container-narrow">
        <div className="app-page-header rise-enter">
          <div className="label-caps mb-2">{t("eyebrow")}</div>
          <h1 className="app-page-title">{t("heading")}</h1>
          <p className="app-page-subtitle">{t("headingSub")}</p>
        </div>
        <div className="rise-enter [transition-delay:40ms]">
          <SettingsClient
            user={{ email: user.email ?? "" }}
            profile={profile}
            isDemo={isDemoUser(user)}
          />
        </div>
      </div>
    </div>
  );
}
