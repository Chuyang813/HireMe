import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AI_PROVIDER } from "@/lib/ai/provider";

const PROVIDER_DISPLAY: Record<string, string> = {
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  glm: "GLM",
  anthropic: "Anthropic Claude",
  openai: "OpenAI",
};

export const metadata: Metadata = {
  title: "Privacy",
};

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");
  const provider = PROVIDER_DISPLAY[AI_PROVIDER] ?? AI_PROVIDER;

  const sections = [
    { id: "01", title: t("collectTitle"), body: t("collectBody") },
    {
      id: "02",
      title: t("aiTitle"),
      body: t("aiBody", { provider }),
    },
    { id: "03", title: t("storageTitle"), body: t("storageBody") },
    { id: "04", title: t("retentionTitle"), body: t("retentionBody") },
    { id: "05", title: t("rightsTitle"), body: t("rightsBody") },
    { id: "06", title: t("cookiesTitle"), body: t("cookiesBody") },
    { id: "07", title: t("contactTitle"), body: t("contactBody") },
  ];

  return (
    <article>
      <header className="app-page-header">
        <div className="label-caps mb-2">{t("eyebrow")}</div>
        <h1 className="app-page-title">{t("heading")}</h1>
        <p className="app-page-subtitle italic">{t("lastUpdated")}</p>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{t("intro")}</p>
      </header>

      <div className="mt-10 space-y-3">
        {sections.map((s) => (
          <section
            key={s.id}
            className="grid gap-4 rounded-lg border border-border bg-canvas p-5 sm:grid-cols-[4rem_1fr] sm:gap-6"
          >
            <div className="flex items-baseline gap-2 sm:flex-col sm:items-end">
              <span className="font-display text-2xl text-muted-foreground">
                {s.id}
              </span>
              <span className="label-caps">§</span>
            </div>
            <div>
              <h2 className="font-display text-xl leading-tight">{s.title}</h2>
              <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground">
                {s.body}
              </p>
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
