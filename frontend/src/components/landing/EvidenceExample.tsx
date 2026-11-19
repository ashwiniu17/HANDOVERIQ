import { AlertTriangle } from "lucide-react";

/**
 * An illustration of the product's central idea. The text is sample content,
 * and it is labelled as an example so it is never mistaken for real data.
 */
export function EvidenceExample() {
  return (
    <figure aria-label="Example: findings linked to the passages they came from" className="relative">
      <p className="mb-3 text-sm text-muted">Example, from a sample project note</p>

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-[0_1px_0_rgb(26_22_51/0.04)]">
        <p className="mb-2 text-xs font-semibold text-muted">billing-notes.txt</p>
        <p className="font-serif text-[1.12rem] leading-[1.7] text-ink">
          The service runs on Python 3.12 with PostgreSQL 16. We decided to use Stripe webhooks because polling was too slow.{" "}
          <span className="mark-sweep">Pending: finish the invoice export before the 30th of June.</span>{" "}
          Known issue: the nightly sync fails when the VPN is down.
        </p>
      </div>

      <div className="relative -mt-2 ml-5 space-y-3 sm:ml-10">
        <div className="rounded-2xl border border-line bg-surface p-4 shadow-float">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-brand-ink">Pending task</span>
            <span className="rounded-md bg-success-soft px-2 py-0.5 text-success">Quote verified</span>
          </div>
          <p className="mt-2 text-[15px] font-semibold">Finish the invoice export</p>
          <p className="mt-0.5 text-sm text-ink-soft">The export must be finished before 30 June.</p>
        </div>

        <div className="rounded-2xl border border-warning/30 bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-brand-ink">Decision</span>
            <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 text-warning">
              <AlertTriangle className="size-3" aria-hidden />
              Quote not found
            </span>
          </div>
          <p className="mt-2 text-[15px] font-semibold">Rewrite the sync in Rust</p>
          <p className="mt-0.5 text-sm text-ink-soft">
            Flagged: the document says nothing like this, so it is shown to you as unsupported instead of being trusted.
          </p>
        </div>
      </div>
    </figure>
  );
}
