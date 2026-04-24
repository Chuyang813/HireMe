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
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl">HireMe</span>
            <span className="label-caps">№ 01</span>
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <Link href="/" className="label-caps hover:text-foreground">
              {nav("back")}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:py-20">
        {children}
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
