import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { DemoSection } from "@/components/DemoSection";
import { StartDemoButton } from "@/components/StartDemoButton";

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
  const qualityCards = [
    {
      label: "Offline evals",
      metric: "100%",
      title: "Parser checks",
      body: "Checked fixtures measure JSON validity, schema shape, and expected-field accuracy without calling a live model.",
    },
    {
      label: "Grounding",
      metric: "12",
      title: "Warnings capped",
      body: "Generated drafts are scanned for unsupported emails, links, metrics, dates, and named entities before users export.",
    },
    {
      label: "Context",
      metric: "8",
      title: "Evidence items",
      body: "Resume evidence is selected against job requirements before generation, so prompts focus on relevant experience.",
    },
    {
      label: "Observability",
      metric: "6",
      title: "Event fields",
      body: "AI events capture provider, model, prompt version, document type, latency, and success state for debugging.",
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="font-display text-2xl leading-none">
            HireMe
          </Link>
          <nav className="flex min-w-0 items-center gap-2 text-sm sm:gap-4">
            <LanguageSwitcher />
            <Link
              href="/login"
              className="whitespace-nowrap rounded-lg px-2 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:px-3"
            >
              {nav("logIn")}
            </Link>
            <StartDemoButton className="btn btn-secondary btn-sm whitespace-nowrap" />
            <Link
              href="/signup"
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-lg bg-accent px-3 font-medium text-accent-foreground transition duration-150 ease-out hover:bg-[var(--accent-hover)] active:scale-[0.97] sm:px-5"
            >
              {nav("getStarted")}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <div className="app-page-header rise-enter">
            <p className="label-caps mb-2">{t("tagline")}</p>
            <h1 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
              {t("headline")}
              <br />
              <span className="text-muted-foreground">
                {t("headlineItalic")}
              </span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {t("description")}
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="btn btn-primary"
              >
                {t("cta")}
              </Link>
              <Link
                href="/login"
                className="btn btn-secondary"
              >
                {t("ctaSecondary")}
              </Link>
              <StartDemoButton showError />
            </div>
          </div>

          <div className="surface-card mx-auto mt-10 max-w-5xl overflow-hidden rise-enter [transition-delay:60ms]">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <p className="font-display text-lg leading-tight">Prompt Engineer</p>
                <p className="text-xs text-muted-foreground">Acme - Full-time</p>
              </div>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                Saved
              </span>
            </div>
            <div className="grid min-h-72 grid-cols-[8rem_1fr] sm:grid-cols-[11rem_1fr]">
              <div className="border-r border-border bg-muted/30 p-4 sm:p-5">
                {["Resume", "Cover letter", "Outreach email", "Interview prep"].map((item) => (
                  <div key={item} className="mb-5 flex items-center gap-2 text-xs">
                    <span className="text-accent">OK</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
              <div className="p-4 sm:p-6">
                <div className="rounded-xl border border-border bg-background p-4 shadow-[var(--shadow-sm)] sm:p-6">
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

        <DemoSection
          heading={t("demoHeading")}
          sub={t("demoSub")}
          stepLabels={[t("demoStep1"), t("demoStep2"), t("demoStep3"), t("demoStep4")]}
        />

        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="app-page-header">
              <p className="label-caps mb-2">AI quality layer</p>
              <h2 className="app-page-title">
                Built to be evaluated, grounded, and debugged.
              </h2>
              <p className="app-page-subtitle">
                HireMe treats generation like a product system: fixtures measure parser
                behavior, prompts receive selected evidence, drafts are checked for
                unsupported claims, and AI requests leave redacted quality logs.
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              {qualityCards.map((item) => (
                <div key={item.label} className="surface-card p-5">
                  <div className="flex items-start justify-between gap-4">
                    <p className="label-caps text-[0.68rem]">{item.label}</p>
                    <span className="font-display text-3xl leading-none text-accent">
                      {item.metric}
                    </span>
                  </div>
                  <h3 className="mt-7 text-base font-semibold">{item.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-muted/45">
          <div className="mx-auto w-full max-w-6xl px-6 py-16">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {features.map((f) => (
                <div key={f.title} className="surface-card flex min-h-60 flex-col justify-between p-6">
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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="font-semibold uppercase tracking-wider">
            HireMe - &copy; {new Date().getFullYear()}
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
