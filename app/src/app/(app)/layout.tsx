import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { signoutAction } from "@/lib/auth/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AppNavLink } from "@/components/AppNavLink";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireUser();
  const t = await getTranslations("Nav");

  const navItems = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/applications", label: t("applications") },
    { href: "/tracker", label: t("tracker") },
    { href: "/resumes", label: t("resumes") },
    { href: "/insights", label: t("insights") },
    { href: "/settings", label: t("settings") },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background/95">
        <div className="mx-auto flex h-20 w-full max-w-7xl items-center justify-between px-6">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="font-display text-2xl leading-none">HireMe</span>
            <span className="label-caps text-[0.65rem]">No 01</span>
          </Link>

          <nav className="hidden h-full items-center gap-8 md:flex">
            {navItems.map((n) => (
              <AppNavLink key={n.href} href={n.href} label={n.label} />
            ))}
          </nav>

          <div className="flex items-center gap-4 text-sm">
            <LanguageSwitcher />
            <div className="hidden h-8 w-px bg-border sm:block" />
            <span className="hidden max-w-56 truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action={signoutAction}>
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>

        <nav className="border-t border-border md:hidden">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-5 overflow-x-auto px-6 text-sm">
            {navItems.map((n) => (
              <AppNavLink key={n.href} href={n.href} label={n.label} />
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
