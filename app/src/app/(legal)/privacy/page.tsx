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
      <div className="label-caps mb-6">{t("eyebrow")}</div>
      <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
        {t("heading")}
      </h1>
      <p className="mt-3 text-sm italic text-muted-foreground">
        {t("lastUpdated")}
      </p>
      <p className="mt-8 text-base leading-7 text-muted-foreground">
        {t("intro")}
      </p>

      <div className="mt-12 divide-y divide-border border-y border-border">
        {sections.map((s) => (
          <section
            key={s.id}
            className="grid gap-4 py-8 sm:grid-cols-[5rem_1fr] sm:gap-8"
          >
            <div className="flex items-baseline gap-2 sm:flex-col sm:items-end">
              <span className="font-display text-2xl text-muted-foreground">
                {s.id}
              </span>
              <span className="label-caps">§</span>
            </div>
            <div>
              <h2 className="font-display text-2xl leading-tight">{s.title}</h2>
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
