"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

type LocaleOption = {
  code: "en" | "zh" | "fr";
  native: string;
  english: string;
  shortLabel: string;
};

const LOCALES: LocaleOption[] = [
  { code: "en", native: "English", english: "English", shortLabel: "EN" },
  { code: "zh", native: "中文", english: "Chinese", shortLabel: "中" },
  { code: "fr", native: "Français", english: "French", shortLabel: "FR" },
];

function setLocaleCookie(code: LocaleOption["code"]) {
  globalThis.document.cookie = `locale=${code};path=/;max-age=31536000`;
}

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  useEffect(() => {
    if (!open) return;
    function handlePointer(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointer);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function pick(code: LocaleOption["code"]) {
    setOpen(false);
    if (code === locale) return;
    setLocaleCookie(code);
    try {
      localStorage.setItem("locale", code);
    } catch {
      // localStorage may be unavailable in private mode.
    }
    router.refresh();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Switch language"
        className="inline-flex h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <span>{current.shortLabel}</span>
        <span className="text-xs opacity-70" aria-hidden="true">
          v
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+0.375rem)] z-30 w-56 overflow-hidden rounded-md border border-border bg-background shadow-sm"
        >
          <div className="border-b border-border bg-muted/40 px-3 py-2">
            <p className="label-caps">Language · Langue · 语言</p>
          </div>
          <ul className="py-1">
            {LOCALES.map((opt) => {
              const active = opt.code === locale;
              return (
                <li key={opt.code}>
                  <button
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => pick(opt.code)}
                    className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted ${
                      active ? "bg-muted/60" : ""
                    }`}
                  >
                    <span className="flex flex-col">
                      <span className="font-display text-base leading-tight text-foreground">
                        {opt.native}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {opt.english}
                      </span>
                    </span>
                    <span
                      className={`text-sm ${active ? "text-accent" : "text-transparent"}`}
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

