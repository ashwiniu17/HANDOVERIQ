"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { ChevronRight, Pencil, Trash2 } from "lucide-react";
import { ProjectContext } from "@/components/features/ProjectContext";
import { ProjectForm } from "@/components/features/ProjectForm";
import { ProjectStatusBadge, RoleBadge } from "@/components/features/StatusBadges";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { ErrorState, Skeleton } from "@/components/ui/Feedback";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";
import { ApiError, api, errorMessage } from "@/lib/api";
import { useResource } from "@/lib/hooks";

const TABS = [
  { slug: "", label: "Overview" },
  { slug: "handover", label: "Handover" },
  { slug: "documents", label: "Documents" },
  { slug: "knowledge", label: "AI review" },
  { slug: "members", label: "Members" },
  { slug: "reports", label: "Reports" },
];

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const projectId = Number(params.id);
  const validId = Number.isInteger(projectId) && projectId > 0;

  const { data: project, error, loading, reload } = useResource(
    () => (validId ? api.projects.get(projectId) : Promise.reject(new ApiError(404, "project_not_found", "That project does not exist."))),
    params.id
  );

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (error && !project) {
    const notFound = error instanceof ApiError && error.status === 404;
    return (
      <div className="mx-auto max-w-lg py-10">
        <ErrorState
          title={notFound ? "Project not found" : "We could not load this project"}
          message={notFound ? "It may have been deleted, or you may not have access to it." : error.message}
          onRetry={notFound ? undefined : reload}
        />
        <div className="mt-4 text-center">
          <ButtonLink href="/app/projects" variant="secondary">Back to projects</ButtonLink>
        </div>
      </div>
    );
  }

  if (loading || !project) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-1/2" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  const canEdit = project.my_role !== "incoming";
  const canManage = project.my_role === "owner";
  const base = `/app/projects/${project.id}`;

  async function deleteProject() {
    setDeleting(true);
    try {
      await api.projects.remove(projectId);
      toast.success("Project deleted.");
      router.push("/app/projects");
    } catch (err) {
      toast.error(errorMessage(err));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <ProjectContext.Provider value={{ project, reload, canEdit, canManage }}>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 text-sm text-muted">
        <Link href="/app/projects" className="hover:text-ink hover:underline">Projects</Link>
        <ChevronRight className="size-3.5" aria-hidden />
        <span className="truncate text-ink-soft" aria-current="page">{project.name}</span>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.65rem] font-bold leading-tight tracking-tight sm:text-3xl">{project.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            <RoleBadge role={project.my_role} />
            <span className="text-xs text-muted">Owned by {project.owner.full_name}</span>
          </div>
          {project.description && <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">{project.description}</p>}
        </div>
        <div className="flex gap-2">
          {canEdit && <Button variant="secondary" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="size-3.5" aria-hidden />}>Edit</Button>}
          {canManage && <Button variant="danger-outline" size="sm" onClick={() => setConfirmingDelete(true)} icon={<Trash2 className="size-3.5" aria-hidden />}>Delete</Button>}
        </div>
      </header>

      <nav aria-label="Project sections" className="relative -mx-4 mt-6 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((tab) => {
            const href = tab.slug ? `${base}/${tab.slug}` : base;
            const active = tab.slug ? pathname === href || pathname.startsWith(`${href}/`) : pathname === base;
            return (
              <li key={tab.label}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex items-center gap-2 border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors",
                    active ? "border-brand text-brand-ink" : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
                  )}
                >
                  {tab.label}
                  {tab.slug === "documents" && project.document_count > 0 && (
                    <span className="rounded-full bg-ink/[0.07] px-1.5 text-xs text-ink-soft">{project.document_count}</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="pt-7">{children}</div>

      <Dialog open={editing} onClose={() => setEditing(false)} title="Edit project">
        <ProjectForm
          initial={{ name: project.name, description: project.description ?? "", status: project.status }}
          submitLabel="Save changes"
          onCancel={() => setEditing(false)}
          onSubmit={async (values) => {
            await api.projects.update(project.id, values);
            toast.success("Project updated.");
            setEditing(false);
            reload();
          }}
        />
      </Dialog>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this project?"
        confirmLabel="Delete project"
        busy={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={deleteProject}
        message={
          <>
            <p><strong className="text-ink">{project.name}</strong> will disappear for you and everyone you added, including its documents, handover and reports.</p>
            <p className="mt-2">The data is kept on the server in case it needs to be recovered by an administrator, but you cannot undo this yourself.</p>
          </>
        }
      />
    </ProjectContext.Provider>
  );
}
