import { cn } from "./cn";

export function ProgressBar({ value, label, className }: { value: number; label?: string; className?: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Progress"}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink/10", className)}
    >
      <div className={cn("h-full rounded-full transition-[width] duration-500", clamped === 100 ? "bg-success" : "bg-brand")} style={{ width: `${clamped}%` }} />
    </div>
  );
}
