"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { ErrorState, Spinner } from "@/components/ui/Feedback";
import { useAuth } from "@/lib/auth";

/**
 * Keeps signed-out visitors out of the app. This is only the visible half of
 * the protection: the server refuses every request without a valid session,
 * so nothing private is ever sent to a visitor who is not signed in.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading, serverError, retry } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user && !serverError) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, serverError, router, pathname]);

  if (serverError && !user) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-lg items-center px-4">
        <div className="w-full">
          <ErrorState title="Cannot reach HANDOVERIQ" message={serverError} onRetry={retry} />
        </div>
      </div>
    );
  }
  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner label="Checking your session…" />
      </div>
    );
  }
  return <>{children}</>;
}
