"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { api, errorMessage, getFieldErrors } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { firstError, validatePassword, validateRequired } from "@/lib/validation";

function ProfileForm() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.full_name ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = firstError({ full_name: validateRequired(name, "your name", 100) });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      setUser(await api.users.updateProfile(name.trim()));
      toast.success("Profile updated.");
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-bold tracking-tight">Profile</h2>
      <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} error={errors.full_name} autoComplete="name" />
      <Input label="E-mail" value={user?.email ?? ""} disabled hint="Your e-mail address is how the people you work with add you to projects." readOnly />
      <Button type="submit" loading={busy}>Save profile</Button>
    </form>
  );
}

function PasswordForm() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = firstError({ current_password: current ? null : "Enter your current password.", new_password: validatePassword(next) });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      await api.users.changePassword(current, next);
      toast.success("Password changed. Your other devices were signed out.");
      setCurrent("");
      setNext("");
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-lg font-bold tracking-tight">Password</h2>
      <Input label="Current password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current_password} autoComplete="current-password" />
      <Input label="New password" type="password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.new_password} autoComplete="new-password" hint="At least 8 characters." />
      <Button type="submit" loading={busy}>Change password</Button>
    </form>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Settings" description="Your account." />
      <div className="space-y-6">
        <ProfileForm />
        <PasswordForm />
        <Notice>Changing your password signs you out everywhere else.</Notice>
      </div>
    </div>
  );
}
