import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "./Button";
import { cn } from "./cn";

export function Spinner({ label = "Loading", className }: { label?: string; className?: string }) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-sm text-muted", className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-ink/[0.07]", className)} />;
}

/** Placeholder rows shown while a list loads. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 py-4">
          <Skeleton className="size-9 shrink-0 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

type EmptyProps = { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode; className?: string };

export function EmptyState({ icon, title, children, action, className }: EmptyProps) {
  return (
    <div className={cn("flex flex-col items-center px-6 py-12 text-center", className)}>
      {icon && <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</div>}
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {children && <p className="mt-1.5 max-w-md text-sm text-ink-soft">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry, title = "We could not load this" }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-xl border border-danger/30 bg-danger-soft px-6 py-10 text-center">
      <AlertTriangle className="mb-3 size-7 text-danger" aria-hidden />
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Notice({ tone = "info", title, children, action }: { tone?: "info" | "warning" | "danger" | "success"; title?: string; children: ReactNode; action?: ReactNode }) {
  const styles = {
    info: "border-brand/25 bg-brand-soft text-brand-ink",
    warning: "border-warning/30 bg-warning-soft text-[#7a410a]",
    danger: "border-danger/30 bg-danger-soft text-[#8f2132]",
    success: "border-success/30 bg-success-soft text-[#0f5a3e]",
  }[tone];
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cn("flex flex-wrap items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm", styles)}>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && "mt-0.5", "leading-relaxed")}>{children}</div>
      </div>
      {action}
    </div>
  );
}
