import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "outline" | "danger";

const base =
  "inline-flex h-10 items-center justify-center rounded-sm px-4 text-sm font-medium disabled:opacity-50 disabled:pointer-events-none transition";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:opacity-90",
  ghost: "text-muted-foreground hover:text-foreground",
  outline: "border border-border hover:bg-muted",
  danger: "border border-border text-danger hover:bg-muted",
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
