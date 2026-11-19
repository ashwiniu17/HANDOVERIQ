import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const CONTROL =
  "block w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-muted/80 transition-colors " +
  "focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand disabled:bg-paper disabled:text-muted";

function controlClass(error?: string | null, extra?: string) {
  return cn(CONTROL, error ? "border-danger" : "border-line-strong hover:border-ink/40", extra);
}

type FieldShellProps = {
  label: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  children: (ids: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
};

/** A label, a control, a hint and an error message, wired together for screen readers. */
export function FieldShell({ label, hint, error, optional, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-baseline justify-between text-[13px] font-semibold text-ink">
        {label}
        {optional && <span className="text-xs font-normal text-muted">Optional</span>}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

type BaseProps = { label: string; hint?: string; error?: string | null; optional?: boolean };

export function Input({ label, hint, error, optional, className, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={controlClass(error, cn("h-10", className))} {...rest} />
      )}
    </FieldShell>
  );
}

export function Textarea({ label, hint, error, optional, className, ...rest }: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <textarea id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={controlClass(error, cn("py-2 leading-relaxed", className))} {...rest} />
      )}
    </FieldShell>
  );
}

export function Select({ label, hint, error, optional, className, children, ...rest }: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid || undefined} className={controlClass(error, cn("h-10 pr-8", className))} {...rest}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}
