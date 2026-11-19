"use client";

import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { useAuth } from "@/lib/auth";

export function LandingHeader() {
  const { user, loading } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
        <Logo />
        <nav aria-label="Page sections" className="hidden items-center gap-7 text-sm font-semibold text-ink-soft md:flex">
          <Link href="#how-it-works" className="hover:text-ink">How it works</Link>
          <Link href="#features" className="hover:text-ink">Features</Link>
          <Link href="#why" className="hover:text-ink">Why it helps</Link>
        </nav>
        <div className="flex items-center gap-2">
          {!loading && user ? (
            <ButtonLink href="/app" size="sm">Open your projects</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
              <ButtonLink href="/register" size="sm">Get started</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
