"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Notice, Spinner } from "@/components/ui/Feedback";
import { ApiError, errorMessage, getFieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { firstError, validateEmail, validatePassword, validateRequired } from "@/lib/validation";

export default function RegisterPage() {
  const { user, loading, register } = useAuth();
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/app");
  }, [loading, user, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const found = firstError({
      full_name: validateRequired(fullName, "your name", 100),
      email: validateEmail(email),
      password: validatePassword(password),
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await register(fullName.trim(), email.trim(), password);
      router.replace("/app");
    } catch (error) {
      const fields = getFieldErrors(error);
      setErrors(fields);
      if (error instanceof ApiError && error.code === "email_taken") setErrors({ email: error.message });
      else setFormError(Object.keys(fields).length > 0 ? "" : errorMessage(error));
      setBusy(false);
    }
  }

  if (loading || user) {
    return <Spinner label="Checking your session…" />;
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-2 text-sm text-ink-soft">Start a handover that the next person can trust.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        {formError && <Notice tone="danger">{formError}</Notice>}
        <Input label="Full name" name="name" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} error={errors.full_name} />
        <Input label="E-mail" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Input
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters. A short phrase of unrelated words works well."
        />
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-brand underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
