"use client";

import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ActivityFeed } from "@/components/features/ActivityFeed";
import { useProject } from "@/components/features/ProjectContext";
import { HandoverStatusBadge } from "@/components/features/StatusBadges";
import { Avatar } from "@/components/ui/Avatar";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { cn } from "@/components/ui/cn";
import { api } from "@/lib/api";
import { useResource } from "@/lib/hooks";
import { buildSteps } from "@/lib/journey";
import type { Member } from "@/lib/types";

function Person({ label, member }: { label: string; member: Member | undefined }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-muted">{label}</p>
      {member ? (
        <div className="mt-2 flex items-center gap-3">
          <Avatar name={member.name} className="size-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            <p className="truncate text-xs text-muted">{member.has_account ? member.email : `${member.email} (not signed up yet)`}</p>
          </div>
        </div>
      ) : (
        <p className="mt-2 text-sm text-ink-soft">Not assigned yet</p>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const { project } = useProject();
  const base = `/app/projects/${project.id}`;

  const overview = useResource(async () => {
    const [members, handover, knowledge, ai, activity] = await Promise.all([
      api.members.list(project.id),
      api.handover.get(project.id),
      api.knowledge.list(project.id),
      api.knowledge.status(),
      api.projects.activity(project.id),
    ]);
    return { members, handover, knowledge, ai, activity };
  }, `${project.id}:${project.document_count}`);

  if (overview.error && !overview.data) return <ErrorState message={overview.error.message} onRetry={overview.reload} />;
  if (!overview.data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  const { members, handover, knowledge, ai, activity } = overview.data;
  const steps = buildSteps({ base, members, documentCount: project.document_count, knowledge, aiConfigured: ai.configured, handover });
  const currentIndex = steps.findIndex((s) => !s.done);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="space-y-8">
        <section aria-labelledby="journey">
          <h2 id="journey" className="mb-3 text-lg font-bold tracking-tight">The handover, step by step</h2>
          <ol className="overflow-hidden rounded-2xl border border-line bg-surface">
            {steps.map((step, index) => {
              const current = index === currentIndex;
              return (
                <li key={step.title} className={cn("flex gap-4 border-b border-line px-5 py-4 last:border-b-0", current && "bg-brand-soft/50")}>
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      step.done ? "bg-success text-white" : current ? "bg-brand text-white" : "bg-ink/10 text-ink-soft"
                    )}
                  >
                    {step.done ? <Check className="size-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold">
                      {step.title}
                      <span className="sr-only">{step.done ? " (done)" : current ? " (next)" : ""}</span>
                    </p>
                    <p className="mt-0.5 text-sm text-ink-soft">{step.detail}</p>
                  </div>
                  <Link href={step.href} className="inline-flex shrink-0 items-center gap-1 self-center text-sm font-semibold text-brand hover:underline">
                    <span className="hidden sm:inline">{step.cta}</span>
                    <ArrowRight className="size-4" aria-label={step.cta} />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="people" className="rounded-2xl border border-line bg-surface p-5">
          <h2 id="people" className="mb-4 text-lg font-bold tracking-tight">Who is handing over to whom</h2>
          <div className="flex flex-wrap items-start gap-x-8 gap-y-5">
            <Person label="Outgoing member" member={members.find((m) => m.role === "outgoing")} />
            <Person label="Incoming member" member={members.find((m) => m.role === "incoming")} />
          </div>
        </section>
      </div>

      <div className="space-y-8">
        <section aria-labelledby="progress" className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 id="progress" className="text-lg font-bold tracking-tight">Handover progress</h2>
            <HandoverStatusBadge status={handover?.status ?? null} />
          </div>
          {handover ? (
            <>
              <ProgressBar value={handover.progress} label="Handover progress" />
              <p className="mt-2 text-sm text-ink-soft">{handover.completed_sections} of {handover.total_sections} sections complete ({handover.progress}%).</p>
              <ul className="mt-4 space-y-1.5 text-sm">
                {handover.sections.map((section) => (
                  <li key={section.section_type} className="flex items-center gap-2">
                    <span aria-hidden className={cn("flex size-4 items-center justify-center rounded-full", section.is_complete ? "bg-success text-white" : "border border-line-strong")}>
                      {section.is_complete && <Check className="size-3" />}
                    </span>
                    <span className={section.is_complete ? "text-ink" : "text-ink-soft"}>{section.title}</span>
                    <span className="sr-only">{section.is_complete ? "complete" : "not complete"}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm text-ink-soft">No handover has been started for this project.</p>
          )}
        </section>

        <section aria-labelledby="activity">
          <h2 id="activity" className="mb-1 text-lg font-bold tracking-tight">Recent activity</h2>
          {activity.length === 0 ? <p className="py-4 text-sm text-ink-soft">Nothing yet.</p> : <ActivityFeed items={activity.slice(0, 8)} />}
        </section>
      </div>
    </div>
  );
}
