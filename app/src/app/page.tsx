import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function Home() {
  const t = await getTranslations("Landing");
  const nav = await getTranslations("Nav");
  const legal = await getTranslations("Legal");

  const features = [
    { title: t("feature01Title"), body: t("feature01Body") },
    { title: t("feature02Title"), body: t("feature02Body") },
    { title: t("feature03Title"), body: t("feature03Body") },
    { title: t("feature04Title"), body: t("feature04Body") },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <Link href="/" className="font-display text-2xl leading-none">
            HireMe
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="rounded-md px-3 py-2 font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {nav("logIn")}
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              {nav("getStarted")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-16 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="label-caps mb-8">{t("tagline")}</p>
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
                className="inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
              >
                {t("cta")}
              </Link>
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-md border border-border px-6 text-sm font-semibold shadow-sm transition-colors hover:bg-muted"
              >
                {t("ctaSecondary")}
              </Link>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-display text-lg leading-tight">Prompt Engineer</p>
                <p className="text-xs text-muted-foreground">Acme · Full-time</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                Saved
              </span>
            </div>
            <div className="grid min-h-72 grid-cols-[11rem_1fr]">
              <div className="border-r border-border bg-muted/30 p-5">
                {["Resume", "Cover letter", "Outreach email", "Interview prep"].map((item) => (
                  <div key={item} className="mb-5 flex items-center gap-2 text-xs">
                    <span className="text-accent">✓</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="p-6">
                <div className="rounded-md border border-border bg-background p-6 shadow-sm">
                  {["Tailored resume", "Cover letter", "Outreach email"].map((label) => (
                    <div key={label} className="mb-8 last:mb-0">
                      <p className="label-caps mb-3 text-[0.62rem]">{label}</p>
                      <div className="space-y-2">
                        <div className="h-2 rounded-full bg-muted" />
                        <div className="h-2 rounded-full bg-muted" />
                        <div className="h-2 w-4/5 rounded-full bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-muted/45">
          <div className="mx-auto w-full max-w-7xl px-6 py-20">
            <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <div key={f.title} className="flex min-h-64 flex-col justify-between bg-background p-7">
                  <div>
                    <h2 className="font-display text-2xl leading-tight">{f.title}</h2>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {f.body}
                    </p>
                  </div>
                  <span className="mt-8 text-xl text-muted-foreground" aria-hidden="true">
                    -&gt;
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold uppercase tracking-wider">
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
