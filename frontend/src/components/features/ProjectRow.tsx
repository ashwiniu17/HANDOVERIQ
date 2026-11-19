import Link from "next/link";
import { FileText, Users } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { formatDate } from "@/lib/format";
import type { Project } from "@/lib/types";
import { HandoverStatusBadge, ProjectStatusBadge, RoleBadge } from "./StatusBadges";

export function ProjectRow({ project }: { project: Project }) {
  return (
    <li>
      <Link
        href={`/app/projects/${project.id}`}
        className="group grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl px-3 py-4 transition-colors hover:bg-brand-soft/60 md:grid-cols-[minmax(0,1fr)_14rem] md:items-center"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-[15px] font-semibold text-ink group-hover:text-brand-ink">{project.name}</h3>
            <ProjectStatusBadge status={project.status} />
            {project.my_role !== "owner" && <RoleBadge role={project.my_role} />}
          </div>
          {project.description && <p className="mt-1 line-clamp-1 text-sm text-ink-soft">{project.description}</p>}
          <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1"><FileText className="size-3.5" aria-hidden />{project.document_count} document{project.document_count === 1 ? "" : "s"}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" aria-hidden />{project.member_count} member{project.member_count === 1 ? "" : "s"}</span>
            <span>Updated {formatDate(project.updated_at)}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <HandoverStatusBadge status={project.handover_status} />
            {project.handover_status && <span className="font-semibold text-ink-soft">{project.handover_progress}%</span>}
          </div>
          {project.handover_status && <ProgressBar value={project.handover_progress} label={`${project.name} handover progress`} />}
        </div>
      </Link>
    </li>
  );
}
