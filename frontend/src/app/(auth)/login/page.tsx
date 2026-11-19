"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Feedback";
import { ApiError, errorMessage, getFieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { safeNext } from "@/lib/navigation";
import { firstError, validateEmail } from "@/lib/validation";

function LoginForm() {
  const { user, loading, login } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = firstError({ email: validateEmail(email), password: password ? null : "Enter your password." });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(error instanceof ApiError && error.code === "validation_error" ? "" : errorMessage(error));
      setBusy(false);
    }
  }

  if (loading || user) {
    return <Spinner label="Checking your session…" />;
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-ink-soft">Sign in to continue your handovers.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Input label="E-mail" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input label="Password" type="password" name="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        New to HandoverIQ?{" "}
        <Link href="/register" className="font-semibold text-brand underline-offset-2 hover:underline">
          Create an account
        </Link>
      </p>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
