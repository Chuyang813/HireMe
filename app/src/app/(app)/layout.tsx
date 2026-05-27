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
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Nav");
  const { data: defaultResume } = await supabase
    .from("base_resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  const hasRequiredResume = !!defaultResume;

  const navItems = [
    { href: "/dashboard", label: t("dashboard") },
    { href: "/applications", label: t("applications") },
    { href: "/resumes", label: t("resumes") },
    { href: "/insights", label: t("insights") },
    { href: "/settings", label: t("settings") },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:px-6">
          <Link
            href={hasRequiredResume ? "/dashboard" : "/onboarding"}
            className="font-display text-xl leading-none"
          >
            HireMe
          </Link>

          {hasRequiredResume ? (
            <nav className="hidden h-full items-center gap-6 md:flex">
              {navItems.map((n) => (
                <AppNavLink key={n.href} href={n.href} label={n.label} />
              ))}
            </nav>
          ) : (
            <div className="hidden md:block" />
          )}

          <div className="flex items-center gap-3 text-sm">
            <LanguageSwitcher />
            <div className="hidden h-5 w-px bg-border sm:block" />
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">
              {user.email}
            </span>
            <form action={signoutAction}>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
              >
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>

        {hasRequiredResume ? (
          <nav className="border-t border-border md:hidden">
            <div className="mx-auto flex w-full max-w-7xl items-center gap-3 overflow-x-auto px-3 text-xs sm:gap-5 sm:px-6 sm:text-sm">
              {navItems.map((n) => (
                <AppNavLink key={n.href} href={n.href} label={n.label} />
              ))}
            </div>
          </nav>
        ) : null}
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
