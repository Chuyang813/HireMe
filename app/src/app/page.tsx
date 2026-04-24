import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function Home() {
  const t = await getTranslations("Landing");
  const nav = await getTranslations("Nav");
  const legal = await getTranslations("Legal");

  const features = [
    { index: "01", title: t("feature01Title"), body: t("feature01Body") },
    { index: "02", title: t("feature02Title"), body: t("feature02Body") },
    { index: "03", title: t("feature03Title"), body: t("feature03Body") },
    { index: "04", title: t("feature04Title"), body: t("feature04Body") },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl">HireMe</span>
            <span className="label-caps">№ 01</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="rounded-sm px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              {nav("logIn")}
            </Link>
            <Link
              href="/signup"
              className="rounded-sm bg-accent px-4 py-1.5 font-medium text-accent-foreground hover:opacity-90"
            >
              {nav("getStarted")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-5xl px-6 py-28 sm:py-32">
          <div className="label-caps mb-8">{t("tagline")}</div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            {t("headline")}
            <br />
            <span className="italic text-muted-foreground">
              {t("headlineItalic")}
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
            {t("description")}
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-sm bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              {t("cta")}
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-sm border border-border px-6 text-sm font-medium hover:bg-muted"
            >
              {t("ctaSecondary")}
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-muted/60">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <div className="label-caps mb-10">{t("featuresLabel")}</div>
            <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.index}
                  className="flex flex-col gap-3 bg-background p-8"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-2xl text-muted-foreground">
                      {f.index}
                    </span>
                    <span className="label-caps">{t("featuresChapter")}</span>
                  </div>
                  <h2 className="font-display text-2xl leading-tight">
                    {f.title}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="label-caps">
            HireMe · © {new Date().getFullYear()}
          </span>
          <span className="italic">{t("footerDisclaimer")}</span>
          <span className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              {legal("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {legal("terms")}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
