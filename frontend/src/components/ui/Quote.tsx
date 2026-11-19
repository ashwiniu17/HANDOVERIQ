import { AlertTriangle } from "lucide-react";
import { cn } from "./cn";

/**
 * A passage quoted from a user's document: serif type, marked with the
 * highlighter when it was verified against the document's text. A passage the
 * AI cited but that is NOT in the document is shown plainly, with a warning.
 */
export function Quote({ text, source, verified, className }: { text: string; source: string; verified: boolean; className?: string }) {
  return (
    <figure className={cn("border-l-2 pl-3", verified ? "border-mark" : "border-warning/60", className)}>
      <blockquote className="font-serif text-[1.02rem] leading-relaxed text-ink">
        {verified ? <span className="mark">“{text}”</span> : <span className="text-ink-soft">“{text}”</span>}
      </blockquote>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>From {source}</span>
        {!verified && (
          <span className="inline-flex items-center gap-1 font-semibold text-warning">
            <AlertTriangle className="size-3.5" aria-hidden />
            Not found in the document. Check before accepting.
          </span>
        )}
      </figcaption>
    </figure>
  );
}
