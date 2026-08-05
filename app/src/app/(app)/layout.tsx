import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/current-user";
import { signoutAction } from "@/lib/auth/actions";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AppNavLink } from "@/components/AppNavLink";
import { MobileNav } from "@/components/MobileNav";
import { isDemoUser } from "@/lib/demo";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase, user } = await requireUser();
  const t = await getTranslations("Nav");
  const demoT = await getTranslations("Demo");
  const isDemo = isDemoUser(user);
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
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-3 sm:px-6">
          <Link
            href={hasRequiredResume ? "/dashboard" : "/onboarding"}
            className="font-display text-xl leading-none tracking-[-0.04em]"
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
            {isDemo ? <span className="badge badge-saved">{demoT("badge")}</span> : null}
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">
              {isDemo ? demoT("sessionLabel") : user.email}
            </span>
            <form action={signoutAction}>
              <button
                type="submit"
                className="btn btn-secondary btn-sm"
              >
                {t("signOut")}
              </button>
            </form>
            {hasRequiredResume && <MobileNav navItems={navItems} />}
          </div>
        </div>
      </header>
      <main className="flex-1 bg-canvas">{children}</main>
    </div>
  );
}
