"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, CheckCircle2, ClipboardList, Lock, RotateCcw, Send } from "lucide-react";
import { useProject } from "@/components/features/ProjectContext";
import { HandoverStatusBadge } from "@/components/features/StatusBadges";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Field";
import { EmptyState, ErrorState, Notice, Skeleton } from "@/components/ui/Feedback";
import { Markdown } from "@/components/ui/Markdown";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError, api, errorMessage, getFieldErrors } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { Handover, Member, SectionType } from "@/lib/types";

const SECTION_HINT: Record<SectionType, string> = {
  overview: "What the project is, who it serves and where it stands today.",
  technical: "Architecture, technologies, environments and how the pieces fit together.",
  completed_tasks: "What has been finished, so nobody repeats it.",
  pending_tasks: "What is still open, in the order the next person should tackle it.",
  decisions: "Choices that were made and why, so they are not reopened by accident.",
  dependencies: "People, services, accounts and deadlines the project relies on.",
  known_issues: "Bugs, risks and workarounds. If there are none, say so.",
  setup: "How to install, run, deploy and get access, step by step.",
  recommendations: "What you would do next if you were staying.",
};

function Person({ label, member }: { label: string; member: Member | undefined }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={member?.name ?? "?"} className="size-9" />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="truncate text-sm font-semibold">{member?.name ?? "Not assigned"}</p>
      </div>
    </div>
  );
}

export default function HandoverPage() {
  const { project, canEdit, canManage, reload: reloadProject } = useProject();
  const toast = useToast();

  const state = useResource(async () => {
    const [handover, members] = await Promise.all([api.handover.get(project.id), api.members.list(project.id)]);
    return { handover, members };
  }, project.id);

  const [selected, setSelected] = useState<SectionType>("overview");
  const [drafts, setDrafts] = useState<Partial<Record<SectionType, string>>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"complete" | "reopen" | null>(null);

  if (state.error && !state.data) return <ErrorState message={state.error.message} onRetry={state.reload} />;
  if (!state.data) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const { handover, members } = state.data;

  function update(next: Handover) {
    state.setData({ handover: next, members });
    reloadProject();
  }

  async function run(label: string, action: () => Promise<Handover>, success: string) {
    setBusy(label);
    try {
      update(await action());
      toast.success(success);
    } catch (err) {
      const incomplete =
        err instanceof ApiError && err.code === "handover_incomplete"
          ? (err.details as { incomplete_sections?: string[] } | undefined)?.incomplete_sections
          : undefined;
      toast.error(incomplete ? `${errorMessage(err)} Still open: ${incomplete.join(", ")}.` : errorMessage(err));
      state.reload();
    } finally {
      setBusy(null);
      setConfirm(null);
    }
  }

  if (handover === null) {
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <EmptyState
          icon={<ClipboardList className="size-6" aria-hidden />}
          title="No handover yet"
          action={canEdit ? (
            <Button loading={busy === "start"} onClick={() => run("start", () => api.handover.start(project.id), "Handover started. Fill in each section, or let the AI draft from your documents.")}>
              Start the handover
            </Button>
          ) : undefined}
        >
          {canEdit
            ? "Starting a handover creates its nine sections: overview, technical documentation, tasks, decisions, dependencies, known issues, setup instructions and recommendations."
            : "The outgoing member has not started the handover yet. It will appear here when they do."}
        </EmptyState>
      </div>
    );
  }

  const locked = handover.status === "completed";
  const editable = canEdit && !locked;
  const section = handover.sections.find((s) => s.section_type === selected) ?? handover.sections[0];
  const draft = drafts[section.section_type];
  const value = draft ?? section.content;
  const dirty = draft !== undefined && draft.trim() !== section.content.trim();
  const outgoing = members.find((m) => m.role === "outgoing");
  const incoming = members.find((m) => m.role === "incoming");
  const allComplete = handover.completed_sections === handover.total_sections;

  async function saveSection(markComplete?: boolean) {
    setBusy("section");
    setErrors({});
    try {
      const body: { content?: string; is_complete?: boolean } = {};
      if (dirty) body.content = value;
      if (markComplete !== undefined) body.is_complete = markComplete;
      const next = await api.handover.updateSection(project.id, section.section_type, body);
      update(next);
      setDrafts((current) => {
        const { [section.section_type]: _removed, ...rest } = current;
        void _removed;
        return rest;
      });
      toast.success(markComplete ? `“${section.title}” marked complete.` : "Saved.");
    } catch (err) {
      setErrors(getFieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="status-heading" className="rounded-2xl border border-line bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1 basis-72">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="status-heading" className="text-lg font-bold tracking-tight">Handover</h2>
              <HandoverStatusBadge status={handover.status} />
              {locked && <span className="inline-flex items-center gap-1 text-xs text-muted"><Lock className="size-3" aria-hidden />Locked</span>}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={handover.progress} label="Handover progress" className="max-w-xs" />
              <span className="text-sm font-semibold text-ink-soft">{handover.completed_sections} of {handover.total_sections} sections</span>
            </div>
            {locked && (
              <p className="mt-3 text-sm text-ink-soft">
                Completed {formatDateTime(handover.completed_at)}{handover.completed_by_name ? ` by ${handover.completed_by_name}` : ""}.
                {handover.acknowledged_at ? ` Acknowledged by ${handover.acknowledged_by_name} on ${formatDateTime(handover.acknowledged_at)}.` : " Waiting for the incoming member to acknowledge it."}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {handover.status === "draft" && canEdit && (
              <Button variant="secondary" loading={busy === "review"} onClick={() => run("review", () => api.handover.submitReview(project.id), "Sent for review.")} icon={<Send className="size-4" aria-hidden />}>Send for review</Button>
            )}
            {!locked && canEdit && (
              <Button disabled={!allComplete} onClick={() => setConfirm("complete")} icon={<CheckCircle2 className="size-4" aria-hidden />}>Complete handover</Button>
            )}
            {locked && canManage && (
              <Button variant="secondary" onClick={() => setConfirm("reopen")} icon={<RotateCcw className="size-4" aria-hidden />}>Reopen</Button>
            )}
            {locked && project.my_role === "incoming" && !handover.acknowledged_at && (
              <Button loading={busy === "ack"} onClick={() => run("ack", () => api.handover.acknowledge(project.id), "Thank you. The outgoing team can see that you have the handover.")} icon={<Check className="size-4" aria-hidden />}>Acknowledge receipt</Button>
            )}
          </div>
        </div>

        {!locked && canEdit && !allComplete && (
          <p className="mt-3 text-xs text-muted">Mark every section complete to finish the handover. Empty sections cannot be marked complete; if there is nothing to add, say so in a sentence.</p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-line pt-4">
          <Person label="Outgoing member" member={outgoing} />
          <ArrowRight className="size-4 text-muted" aria-label="hands over to" />
          <Person label="Incoming member" member={incoming} />
          {(!outgoing || !incoming) && canManage && (
            <Link href={`/app/projects/${project.id}/members`} className="ml-auto text-sm font-semibold text-brand hover:underline">Assign people</Link>
          )}
        </div>
      </section>

      {project.my_role === "incoming" && !locked && (
        <Notice>This handover is still being written. You can read what is here, but it may change until it is completed.</Notice>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Handover sections" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          {/* "relative" matters: it keeps the screen-reader-only labels inside this scroller, so they cannot stretch the page. */}
          <ul className="relative flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {handover.sections.map((s) => {
              const active = s.section_type === section.section_type;
              const hasDraft = drafts[s.section_type] !== undefined && drafts[s.section_type]!.trim() !== s.content.trim();
              return (
                <li key={s.section_type} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => { setSelected(s.section_type); setErrors({}); }}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors",
                      active ? "bg-brand-soft text-brand-ink" : "text-ink-soft hover:bg-ink/5 hover:text-ink"
                    )}
                  >
                    <span aria-hidden className={cn("flex size-[18px] shrink-0 items-center justify-center rounded-full", s.is_complete ? "bg-success text-white" : "border border-line-strong bg-surface")}>
                      {s.is_complete && <Check className="size-3" />}
                    </span>
                    <span className="whitespace-nowrap lg:whitespace-normal">{s.title}</span>
                    <span className="sr-only">{s.is_complete ? "(complete)" : "(not complete)"}</span>
                    {hasDraft && <span className="ml-auto size-2 shrink-0 rounded-full bg-warning" title="Unsaved changes"><span className="sr-only">Unsaved changes</span></span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <section aria-labelledby="section-heading" className="min-w-0 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 id="section-heading" className="text-xl font-bold tracking-tight">{section.title}</h2>
              <p className="mt-0.5 text-sm text-ink-soft">{SECTION_HINT[section.section_type]}</p>
            </div>
            {section.is_complete && <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-xs font-semibold text-success"><Check className="size-3" aria-hidden />Complete</span>}
          </div>

          <div className="mt-5">
            {editable ? (
              <>
                <Textarea
                  label={`${section.title} text`}
                  rows={Math.min(24, Math.max(10, value.split("\n").length + 2))}
                  value={value}
                  onChange={(e) => setDrafts((current) => ({ ...current, [section.section_type]: e.target.value }))}
                  error={errors.content}
                  hint="Start a line with - for a bullet or 1. for a numbered step. Use **bold** and `code` where it helps."
                  className="font-serif text-[15px]"
                  maxLength={50000}
                />
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button onClick={() => saveSection()} disabled={!dirty} loading={busy === "section"}>Save</Button>
                  {section.is_complete && !dirty ? (
                    <Button variant="secondary" onClick={() => saveSection(false)} loading={busy === "section"}>Mark as not complete</Button>
                  ) : (
                    <Button variant="secondary" onClick={() => saveSection(true)} loading={busy === "section"} icon={<Check className="size-4" aria-hidden />}>
                      {dirty ? "Save and mark complete" : "Mark complete"}
                    </Button>
                  )}
                  {dirty && <span className="text-xs text-warning">Unsaved changes</span>}
                </div>
              </>
            ) : section.content ? (
              <Markdown content={section.content} className="font-serif text-base" />
            ) : (
              <p className="text-sm text-ink-soft">Nothing has been written in this section.</p>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={confirm === "complete"}
        title="Complete the handover?"
        tone="primary"
        confirmLabel="Complete handover"
        busy={busy === "complete"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run("complete", () => api.handover.complete(project.id), "Handover completed. The incoming member can now acknowledge it.")}
        message="All sections will be locked so the incoming member reads what you finished. The owner can reopen it later if something has to change."
      />
      <ConfirmDialog
        open={confirm === "reopen"}
        title="Reopen the handover?"
        tone="primary"
        confirmLabel="Reopen"
        busy={busy === "reopen"}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run("reopen", () => api.handover.reopen(project.id), "Handover reopened for editing.")}
        message="It goes back to draft and any acknowledgement is cleared, because the content may change."
      />
    </div>
  );
}
