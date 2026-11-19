import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <main id="main" className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <p className="text-xs text-muted">Your documents stay inside your projects. Only the people you add can see them.</p>
      </div>

      <aside aria-hidden className="relative hidden overflow-hidden bg-ink px-12 py-14 text-white lg:flex lg:flex-col lg:justify-center">
        <div className="mx-auto w-full max-w-md">
          <p className="mb-5 text-sm text-white/60">How a claim stays honest</p>
          <figure className="rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10">
            <blockquote className="font-serif text-xl leading-relaxed text-white/90">
              “Pending: finish the <span className="mark-sweep text-ink">invoice export before the 30th of June</span>.”
            </blockquote>
            <figcaption className="mt-3 text-xs text-white/50">From billing-notes.txt, quoted word for word</figcaption>
          </figure>
          <div className="ml-8 mt-3 rounded-2xl bg-surface p-5 text-ink">
            <p className="text-xs font-semibold text-brand-ink">Pending task</p>
            <p className="mt-1 text-base font-semibold">Finish the invoice export</p>
            <p className="mt-1 text-sm text-ink-soft">Due before 30 June. Needed by the incoming owner.</p>
          </div>
          <p className="mt-8 text-sm leading-relaxed text-white/60">
            Every item in a HandoverIQ report keeps the passage it came from, so the person taking over can check it instead of taking it on trust.
          </p>
        </div>
      </aside>
    </div>
  );
}
