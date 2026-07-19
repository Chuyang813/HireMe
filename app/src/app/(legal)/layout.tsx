import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nav = await getTranslations("Nav");
  const t = await getTranslations("Legal");

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <header className="border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
          <Link href="/">
            <span className="font-display text-xl">HireMe</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Link href="/" className="label-caps hover:text-foreground">
              {nav("back")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
        <article className="surface-card rise-enter p-6 sm:p-10">{children}</article>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="label-caps">
            HireMe · © {new Date().getFullYear()}
          </span>
          <span className="flex items-center gap-4">
            <Link href="/privacy" className="hover:text-foreground">
              {t("privacy")}
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              {t("terms")}
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
