"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNavLink({ href, label }: { href: string; label: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={[
        "relative flex h-16 items-center px-2 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      ].join(" ")}
    >
      {label}
      {active && (
        <span className="absolute inset-x-1 bottom-0 h-px bg-foreground" />
      )}
    </Link>
  );
}

