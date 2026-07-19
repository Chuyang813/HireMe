import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("Nav");

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
              {t("back")}
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-6 py-12">
        <div className="surface-card rise-enter p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
