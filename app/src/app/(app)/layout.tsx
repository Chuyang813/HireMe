import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { signoutAction } from "@/lib/auth/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

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
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="flex items-baseline gap-2">
            <span className="font-display text-xl">HireMe</span>
            <span className="label-caps">№ 01</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm sm:flex">
            {navItems.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-sm px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2 text-sm">
            <LanguageSwitcher />
            <span className="label-caps hidden sm:inline">{user.email}</span>
            <form action={signoutAction}>
              <button
                type="submit"
                className="rounded-sm border border-border px-3 py-1.5 text-sm hover:bg-muted"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
        <nav className="sm:hidden border-t border-border">
          <div className="mx-auto flex w-full max-w-6xl items-center gap-1 overflow-x-auto px-6 py-2 text-sm">
            {navItems.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="whitespace-nowrap rounded-sm px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
