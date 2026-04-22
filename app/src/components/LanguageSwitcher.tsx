"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();

  const toggle = () => {
    const next = locale === "en" ? "zh" : "en";
    document.cookie = `locale=${next};path=/;max-age=31536000`;
    localStorage.setItem("locale", next);
    router.refresh();
  };

  return (
    <button
      onClick={toggle}
      className="label-caps rounded-sm px-2 py-1.5 text-muted-foreground hover:text-foreground"
      aria-label="Switch language"
    >
      {locale === "en" ? "中文" : "EN"}
    </button>
  );
}
