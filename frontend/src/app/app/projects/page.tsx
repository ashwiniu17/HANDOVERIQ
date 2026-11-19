"use client";

import { useEffect, useRef, useState } from "react";
import { FolderPlus, Search } from "lucide-react";
import { ProjectRow } from "@/components/features/ProjectRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui/Feedback";
import { api } from "@/lib/api";
import { PROJECT_STATUS_LABEL } from "@/lib/format";
import { useResource } from "@/lib/hooks";
import type { ProjectStatus } from "@/lib/types";

export default function ProjectsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProjectStatus | "">("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function onSearch(value: string) {
    setSearchInput(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSearch(value.trim()), 250); // wait for a pause in typing
  }

  const { data, error, loading, reload } = useResource(() => api.projects.list({ search, status }), `${search}|${status}`);
  const filtering = Boolean(search || status);

  return (
    <>
      <PageHeader
        title="Projects"
        description="Every project you own or have been added to."
        actions={<ButtonLink href="/app/projects/new" icon={<FolderPlus className="size-4" aria-hidden />}>New project</ButtonLink>}
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            aria-label="Search projects"
            placeholder="Search by name or description"
            value={searchInput}
            onChange={(e) => onSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-sm placeholder:text-muted/80 hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
          />
        </div>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProjectStatus | "")}
          className="h-10 rounded-lg border border-line-strong bg-surface px-3 pr-8 text-sm hover:border-ink/40 focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-brand"
        >
          <option value="">All statuses</option>
          {(Object.keys(PROJECT_STATUS_LABEL) as ProjectStatus[]).map((value) => (
            <option key={value} value={value}>{PROJECT_STATUS_LABEL[value]}</option>
          ))}
        </select>
      </div>

      <div className="rounded-2xl border border-line bg-surface px-2 py-1">
        {error && !data ? (
          <div className="p-3"><ErrorState message={error.message} onRetry={reload} /></div>
        ) : loading && !data ? (
          <div className="px-3"><ListSkeleton /></div>
        ) : data && data.length === 0 ? (
          filtering ? (
            <EmptyState icon={<Search className="size-6" aria-hidden />} title="No projects match">
              Try a different search or clear the status filter.
            </EmptyState>
          ) : (
            <EmptyState
              icon={<FolderPlus className="size-6" aria-hidden />}
              title="No projects yet"
              action={<ButtonLink href="/app/projects/new">Create your first project</ButtonLink>}
            >
              Projects hold the people, documents and handover for one piece of work.
            </EmptyState>
          )
        ) : (
          <ul className="divide-y divide-line">{data?.map((project) => <ProjectRow key={project.id} project={project} />)}</ul>
        )}
      </div>
    </>
  );
}
