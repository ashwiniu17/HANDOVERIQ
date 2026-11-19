"use client";

import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Feedback";
import { errorMessage, getFieldErrors } from "@/lib/api";
import { PROJECT_STATUS_LABEL } from "@/lib/format";
import type { ProjectStatus } from "@/lib/types";
import { firstError, validateRequired } from "@/lib/validation";

export type ProjectFormValues = { name: string; description: string; status: ProjectStatus };

type Props = {
  initial?: Partial<ProjectFormValues>;
  submitLabel: string;
  onSubmit: (values: { name: string; description: string | null; status: ProjectStatus }) => Promise<void>;
  onCancel?: () => void;
  extraActions?: ReactNode;
};

export function ProjectForm({ initial, submitLabel, onSubmit, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<ProjectStatus>(initial?.status ?? "active");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = firstError({
      name: validateRequired(name, "a project name", 120),
      description: description.length > 2000 ? "Use at most 2000 characters." : null,
    });
    setErrors(found);
    setFormError("");
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await onSubmit({ name: name.trim(), description: description.trim() || null, status });
    } catch (error) {
      const fields = getFieldErrors(error);
      setErrors(fields);
      setFormError(Object.keys(fields).length > 0 ? "" : errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && <Notice tone="danger">{formError}</Notice>}
      <Input label="Project name" name="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} maxLength={120} placeholder="For example, Billing platform migration" />
      <Textarea
        label="Description"
        name="description"
        optional
        rows={4}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        error={errors.description}
        hint="What the project is for and who it serves. The AI uses this for context."
      />
      <Select label="Status" name="status" value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus)} error={errors.status}>
        {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((value) => (
          <option key={value} value={value}>{PROJECT_STATUS_LABEL[value]}</option>
        ))}
      </Select>
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        {onCancel && <Button variant="secondary" onClick={onCancel} disabled={busy}>Cancel</Button>}
        <Button type="submit" loading={busy}>{submitLabel}</Button>
      </div>
    </form>
  );
}
