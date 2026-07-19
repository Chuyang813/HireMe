import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";

const base =
  "inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-medium disabled:opacity-50 disabled:pointer-events-none transition duration-150 ease-out active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent/50";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-[var(--accent-hover)]",
  ghost: "text-muted-foreground hover:text-foreground hover:bg-[var(--bg-hover)]",
  outline: "border border-border bg-background text-foreground shadow-[var(--shadow-sm)] hover:bg-[var(--bg-hover)]",
  danger: "border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger-light)]",
};

export function Button({
  variant = "primary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    />
  );
}
