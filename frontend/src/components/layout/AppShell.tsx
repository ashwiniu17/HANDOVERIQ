"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { FolderKanban, LayoutDashboard, LogOut, Menu, Settings } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Logo } from "@/components/ui/Logo";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/app/projects", label: "Projects", icon: FolderKanban, exact: false },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="space-y-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserChip() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function signOut() {
    setBusy(true);
    try {
      await logout();
      router.replace("/login");
    } catch {
      toast.error("Could not sign out. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="border-t border-line pt-4">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={user.full_name} className="size-9" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{user.full_name}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
        </div>
      </div>
      <Button variant="ghost" size="sm" className="mt-3 w-full justify-start" onClick={signOut} loading={busy} icon={<LogOut className="size-4" aria-hidden />}>
        Sign out
      </Button>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col justify-between border-r border-line bg-surface px-4 py-5 lg:flex">
        <div className="space-y-8">
          <Logo href="/app" className="px-1" />
          <NavLinks />
        </div>
        <UserChip />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <Logo href="/app" />
          <Button variant="secondary" size="sm" onClick={() => setMenuOpen(true)} aria-label="Open menu" className="px-2.5">
            <Menu className="size-4" aria-hidden />
          </Button>
        </header>
        <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" size="sm">
          <div className="space-y-6">
            <NavLinks onNavigate={() => setMenuOpen(false)} />
            <UserChip />
          </div>
        </Dialog>

        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
