"use client";

import Link from "next/link";
import { ArrowRight, FileText, FolderPlus, Sparkles, Users } from "lucide-react";
import { ActivityFeed } from "@/components/features/ActivityFeed";
import { ProjectRow } from "@/components/features/ProjectRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton, Skeleton } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useResource } from "@/lib/hooks";

function Stat({ label, value, note }: { label: string; value: number; note: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-[13px] font-semibold text-ink-soft">{label}</dt>
      <dd className="mt-1 text-3xl font-bold tracking-tight text-ink">{value}</dd>
      <p className="mt-0.5 text-xs text-muted">{note}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, error, loading, reload } = useResource(() => api.dashboard(), "dashboard");
  const firstName = user?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Where your handovers stand today."
        actions={
          <ButtonLink href="/app/projects/new" icon={<FolderPlus className="size-4" aria-hidden />}>
            New project
          </ButtonLink>
        }
      />

      {error && !data ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <div className="space-y-6">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <ListSkeleton />
        </div>
      ) : data && data.stats.total_projects === 0 ? (
        <div className="rounded-2xl border border-line bg-surface">
          <EmptyState
            icon={<FolderPlus className="size-6" aria-hidden />}
            title="Start your first handover"
            action={<ButtonLink href="/app/projects/new">Create a project</ButtonLink>}
          >
            A handover begins with a project. Add the people involved, upload what the project knows, and let HandoverIQ draft the handover for you to check.
          </EmptyState>
          <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-b-2xl border-t border-line bg-line text-sm sm:grid-cols-3">
            {[
              { icon: Users, text: "Add the outgoing and incoming members" },
              { icon: FileText, text: "Upload documents: PDF, Word, text or Markdown" },
              { icon: Sparkles, text: "Review what the AI found, quote by quote" },
            ].map(({ icon: Icon, text }, i) => (
              <li key={text} className="flex items-start gap-3 bg-surface px-5 py-4">
                <Icon className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
                <span className="text-ink-soft"><span className="font-semibold text-ink">{i + 1}.</span> {text}</span>
              </li>
            ))}
          </ol>
        </div>
      ) : data ? (
        <div className="space-y-8">
          <dl className="grid grid-cols-2 divide-x divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface md:grid-cols-4 md:divide-y-0">
            <Stat label="Total projects" value={data.stats.total_projects} note="That you own or belong to" />
            <Stat label="Active projects" value={data.stats.active_projects} note="Currently in progress" />
            <Stat label="Completed handovers" value={data.stats.completed_handovers} note="Ready for the next person" />
            <Stat label="Pending handovers" value={data.stats.pending_handovers} note="Draft or in review" />
          </dl>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <section aria-labelledby="recent-projects">
              <div className="mb-2 flex items-center justify-between">
                <h2 id="recent-projects" className="text-lg font-bold tracking-tight">Recent projects</h2>
                <Link href="/app/projects" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
                  All projects <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              </div>
              <ul className="-mx-3">
                {data.recent_projects.map((project) => <ProjectRow key={project.id} project={project} />)}
              </ul>
            </section>

            <section aria-labelledby="recent-activity">
              <h2 id="recent-activity" className="mb-1 text-lg font-bold tracking-tight">Recent activity</h2>
              {data.recent_activity.length === 0 ? (
                <p className="py-6 text-sm text-ink-soft">Nothing has happened yet.</p>
              ) : (
                <ActivityFeed items={data.recent_activity.slice(0, 8)} showProject />
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
