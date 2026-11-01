import type { Project } from "../lib/projects";
import StatusBadge from "./StatusBadge";

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="flex w-full flex-col gap-4 rounded-xl border border-gray-400/40 bg-gray-500/5 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-lg font-semibold leading-snug">
          {project.name}
        </h3>
        <StatusBadge status={project.status} />
      </div>

      {project.description ? (
        <p className="line-clamp-3 break-words text-sm text-gray-600 dark:text-gray-400">
          {project.description}
        </p>
      ) : (
        <p className="text-sm italic text-gray-500">No description</p>
      )}

      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Outgoing
          </dt>
          <dd className="mt-0.5 break-words font-medium">{project.outgoing_member}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Incoming
          </dt>
          <dd className="mt-0.5 break-words font-medium">{project.incoming_member}</dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-gray-400/30 pt-4">
        <p className="text-xs text-gray-500">
          Created{" "}
          <time dateTime={project.created_at}>{formatDate(project.created_at)}</time>
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="rounded-md border border-gray-400/50 px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            View project
          </button>
          <span className="text-xs text-gray-500">Coming soon</span>
        </div>
      </div>
    </article>
  );
}

export default function ProjectList({ projects }: { projects: Project[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id} className="flex">
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}