import { forwardRef } from "react";

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
};

export const Field = forwardRef<HTMLInputElement, InputProps>(function Field(
  { label, hint, id, className = "", ...rest },
  ref,
) {
  const inputId = id ?? rest.name;
  return (
    <label className="flex flex-col gap-1.5" htmlFor={inputId}>
      <span className="label-caps">{label}</span>
      <input
        ref={ref}
        id={inputId}
        className={`h-10 rounded-sm border border-border bg-background px-3 text-sm outline-none focus:border-foreground ${className}`}
        {...rest}
      />
      {hint ? (
        <span className="text-xs text-muted-foreground">{hint}</span>
      ) : null}
    </label>
  );
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function TextareaField({ label, hint, id, className = "", ...rest }, ref) {
    const inputId = id ?? rest.name;
    return (
      <label className="flex flex-col gap-1.5" htmlFor={inputId}>
        <span className="label-caps">{label}</span>
        <textarea
          ref={ref}
          id={inputId}
          className={`min-h-28 rounded-sm border border-border bg-background p-3 text-sm outline-none focus:border-foreground ${className}`}
          {...rest}
        />
        {hint ? (
          <span className="text-xs text-muted-foreground">{hint}</span>
        ) : null}
      </label>
    );
  },
);
