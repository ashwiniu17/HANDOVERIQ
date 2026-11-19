"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, CheckCheck, ChevronDown, FilePlus2, Pencil, Sparkles, Undo2, X } from "lucide-react";
import { useProject } from "@/components/features/ProjectContext";
import { KnowledgeStatusBadge } from "@/components/features/StatusBadges";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorState, ListSkeleton, Notice } from "@/components/ui/Feedback";
import { Quote } from "@/components/ui/Quote";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { api, errorMessage, getFieldErrors } from "@/lib/api";
import { CATEGORY_LABEL, CONFIDENCE_LABEL, KNOWLEDGE_STATUS_LABEL, formatDateTime } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { KnowledgeCategory, KnowledgeItem, KnowledgeStatus } from "@/lib/types";

function ItemCard({ item, canEdit, onChange, busy }: { item: KnowledgeItem; canEdit: boolean; busy: boolean; onChange: (data: { status?: KnowledgeStatus; title?: string; content?: string }) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const locked = item.applied_at !== null;

  async function save() {
    if (!title.trim() || !content.trim()) {
      setErrors({ title: title.trim() ? "" : "Enter a title.", content: content.trim() ? "" : "Enter the text." });
      return;
    }
    setSaving(true);
    const ok = await onChange({ title: title.trim(), content: content.trim() });
    setSaving(false);
    if (ok) {
      setEditing(false);
      setErrors({});
    }
  }

  return (
    <li className={cn("px-5 py-5", item.status === "rejected" && "bg-paper/70")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand">{CATEGORY_LABEL[item.category]}</Badge>
        <KnowledgeStatusBadge status={item.status} />
        <Badge>{CONFIDENCE_LABEL[item.confidence]}</Badge>
        {locked && <Badge tone="success" icon={<Check className="size-3" aria-hidden />}>In the handover</Badge>}
      </div>

      {editing ? (
        <div className="mt-3 space-y-3">
          <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} error={errors.title} maxLength={200} />
          <Textarea label="Text" rows={4} value={content} onChange={(e) => setContent(e.target.value)} error={errors.content} />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={saving}>Save changes</Button>
            <Button size="sm" variant="secondary" disabled={saving} onClick={() => { setEditing(false); setTitle(item.title); setContent(item.content); setErrors({}); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <>
          <h3 className={cn("mt-2.5 text-[15px] font-semibold", item.status === "rejected" && "text-ink-soft line-through decoration-1")}>{item.title}</h3>
          <p className={cn("mt-1 text-sm leading-relaxed", item.status === "rejected" ? "text-muted" : "text-ink-soft")}>{item.content}</p>
        </>
      )}

      {item.source_quote && <Quote className="mt-4" text={item.source_quote} source={item.source_name} verified={item.quote_verified} />}
      {!item.source_quote && <p className="mt-3 text-xs text-warning">The AI gave no supporting quote for this item. Check it against {item.source_name}.</p>}

      {canEdit && !locked && !editing && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {item.status !== "accepted" && item.status !== "edited" && (
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => onChange({ status: "accepted" })} icon={<Check className="size-3.5 text-success" aria-hidden />}>Accept</Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditing(true)} icon={<Pencil className="size-3.5" aria-hidden />}>Edit</Button>
          {item.status === "rejected" ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onChange({ status: "suggested" })} icon={<Undo2 className="size-3.5" aria-hidden />}>Restore</Button>
          ) : (
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft hover:text-danger" disabled={busy} onClick={() => onChange({ status: "rejected" })} icon={<X className="size-3.5" aria-hidden />}>Reject</Button>
          )}
        </div>
      )}
    </li>
  );
}

export default function KnowledgePage() {
  const { project, canEdit } = useProject();
  const toast = useToast();

  const [category, setCategory] = useState<KnowledgeCategory | "">("");
  const [status, setStatus] = useState<KnowledgeStatus | "">("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [showRuns, setShowRuns] = useState(false);

  const all = useResource(() => api.knowledge.list(project.id), project.id);
  const ai = useResource(() => api.knowledge.status(), "ai");
  const runs = useResource(() => api.knowledge.runs(project.id), project.id);

  const items = all.data ?? [];
  const visible = items.filter((i) => (!category || i.category === category) && (!status || i.status === status));
  const waitingVerified = items.filter((i) => i.status === "suggested" && i.quote_verified);
  const toApply = items.filter((i) => (i.status === "accepted" || i.status === "edited") && i.applied_at === null);
  const counts = items.reduce<Record<string, number>>((acc, i) => ({ ...acc, [i.category]: (acc[i.category] ?? 0) + 1 }), {});

  async function change(item: KnowledgeItem, data: { status?: KnowledgeStatus; title?: string; content?: string }): Promise<boolean> {
    setBusyId(item.id);
    try {
      const updated = await api.knowledge.update(project.id, item.id, data);
      all.setData(items.map((i) => (i.id === updated.id ? updated : i)));
      return true;
    } catch (err) {
      const field = getFieldErrors(err);
      toast.error(Object.values(field)[0] ?? errorMessage(err));
      all.reload();
      return false;
    } finally {
      setBusyId(null);
    }
  }

  async function acceptAllVerified() {
    setBulkBusy(true);
    let accepted = 0;
    try {
      for (const item of waitingVerified) {
        await api.knowledge.update(project.id, item.id, { status: "accepted" });
        accepted += 1;
      }
      toast.success(`Accepted ${accepted} item${accepted === 1 ? "" : "s"} whose quotes were found in the document.`);
    } catch (err) {
      toast.error(`${errorMessage(err)} ${accepted > 0 ? `${accepted} were accepted before the problem.` : ""}`.trim());
    } finally {
      setBulkBusy(false);
      all.reload();
    }
  }

  async function apply() {
    setApplyBusy(true);
    try {
      const result = await api.knowledge.apply(project.id);
      toast.success(`Added ${result.applied_count} item${result.applied_count === 1 ? "" : "s"} to the handover. Sections you changed need another look before they count as complete.`);
      all.reload();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setApplyBusy(false);
    }
  }

  const categories = Object.keys(CATEGORY_LABEL) as KnowledgeCategory[];

  return (
    <div className="space-y-6">
      {ai.data && !ai.data.configured && (
        <Notice tone="warning" title="AI analysis is not set up on this server">
          There is nothing to review until the server has an <code className="font-mono text-[13px]">ANTHROPIC_API_KEY</code>. Findings from earlier analyses, if any, are still shown here.
        </Notice>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">
          The AI suggests; you decide. Each finding keeps the passage it came from. Accept what is right, fix what is close, reject what is wrong, then add the result to the handover.
        </p>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {waitingVerified.length > 0 && (
              <Button variant="secondary" onClick={acceptAllVerified} loading={bulkBusy} icon={<CheckCheck className="size-4" aria-hidden />}>
                Accept {waitingVerified.length} with verified quotes
              </Button>
            )}
            <Button onClick={apply} loading={applyBusy} disabled={toApply.length === 0} icon={<FilePlus2 className="size-4" aria-hidden />}>
              Add {toApply.length} to handover
            </Button>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter findings">
          <button type="button" onClick={() => setCategory("")} aria-pressed={category === ""} className={cn("rounded-full border px-3 py-1 text-[13px] font-semibold", category === "" ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40")}>
            All ({items.length})
          </button>
          {categories.filter((c) => counts[c]).map((c) => (
            <button key={c} type="button" onClick={() => setCategory(c)} aria-pressed={category === c} className={cn("rounded-full border px-3 py-1 text-[13px] font-semibold", category === c ? "border-brand bg-brand text-white" : "border-line-strong bg-surface text-ink-soft hover:border-ink/40")}>
              {CATEGORY_LABEL[c]} ({counts[c]})
            </button>
          ))}
          <label className="ml-auto flex items-center gap-2 text-[13px] text-ink-soft">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value as KnowledgeStatus | "")} className="h-8 rounded-lg border border-line-strong bg-surface px-2 pr-7 text-[13px] focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand">
              <option value="">Any</option>
              {(Object.keys(KNOWLEDGE_STATUS_LABEL) as KnowledgeStatus[]).map((s) => <option key={s} value={s}>{KNOWLEDGE_STATUS_LABEL[s]}</option>)}
            </select>
          </label>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {all.error && !all.data ? (
          <div className="p-5"><ErrorState message={all.error.message} onRetry={all.reload} /></div>
        ) : all.loading && !all.data ? (
          <div className="px-5"><ListSkeleton rows={3} /></div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="size-6" aria-hidden />}
            title="Nothing to review yet"
            action={<Link href={`/app/projects/${project.id}/documents`} className="text-sm font-semibold text-brand hover:underline">Go to documents</Link>}
          >
            Upload a document and choose Analyze with AI. What it finds shows up here, each finding next to the exact passage it came from.
          </EmptyState>
        ) : visible.length === 0 ? (
          <EmptyState title="No findings match these filters">Clear a filter to see more.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((item) => (
              <ItemCard key={`${item.id}:${item.updated_at}`} item={item} canEdit={canEdit} busy={busyId === item.id || bulkBusy} onChange={(data) => change(item, data)} />
            ))}
          </ul>
        )}
      </div>

      <section aria-labelledby="runs-heading">
        <button type="button" onClick={() => setShowRuns((v) => !v)} aria-expanded={showRuns} className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink">
          <ChevronDown className={cn("size-4 transition-transform", showRuns && "rotate-180")} aria-hidden />
          <span id="runs-heading">Analysis history</span>
        </button>
        {showRuns && (
          <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
            {runs.data && runs.data.length > 0 ? (
              <ul className="divide-y divide-line text-sm">
                {runs.data.map((run) => (
                  <li key={run.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{run.document_name}</p>
                      <p className="text-xs text-muted">
                        {formatDateTime(run.started_at)} · {run.model}
                        {run.input_tokens != null && ` · ${run.input_tokens.toLocaleString("en-GB")} tokens in, ${(run.output_tokens ?? 0).toLocaleString("en-GB")} out`}
                        {run.truncated && " · long document, only the beginning was read"}
                      </p>
                      {run.status === "failed" && <p className="mt-0.5 text-xs text-danger">{run.error_message}</p>}
                    </div>
                    {run.status === "succeeded" ? <Badge tone="success">{run.items_created} new finding{run.items_created === 1 ? "" : "s"}</Badge> : run.status === "failed" ? <Badge tone="danger">Failed</Badge> : <Badge tone="warning">Running</Badge>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-sm text-ink-soft">No analyses have been run yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
