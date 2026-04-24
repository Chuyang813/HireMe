import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export const metadata: Metadata = {
  title: "Terms",
};

export default async function TermsPage() {
  const t = await getTranslations("Terms");

  const sections = [
    { id: "01", title: t("acceptanceTitle"), body: t("acceptanceBody") },
    { id: "02", title: t("accountTitle"), body: t("accountBody") },
    { id: "03", title: t("acceptableTitle"), body: t("acceptableBody") },
    { id: "04", title: t("aiContentTitle"), body: t("aiContentBody") },
    { id: "05", title: t("ipTitle"), body: t("ipBody") },
    { id: "06", title: t("warrantyTitle"), body: t("warrantyBody") },
    { id: "07", title: t("liabilityTitle"), body: t("liabilityBody") },
    { id: "08", title: t("terminationTitle"), body: t("terminationBody") },
    { id: "09", title: t("changesTitle"), body: t("changesBody") },
    { id: "10", title: t("contactTitle"), body: t("contactBody") },
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
