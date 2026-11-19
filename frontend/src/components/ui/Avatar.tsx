import { initials } from "@/lib/format";
import { cn } from "./cn";

const TINTS = ["bg-brand-soft text-brand-ink", "bg-success-soft text-success", "bg-warning-soft text-warning", "bg-ink/[0.07] text-ink-soft"];

export function Avatar({ name, className }: { name: string; className?: string }) {
  const tint = TINTS[[...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length];
  return (
    <span aria-hidden className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", tint, className)}>
      {initials(name)}
    </span>
  );
}
