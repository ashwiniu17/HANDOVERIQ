import type { ProjectStatus } from "../lib/projects";

const STATUS_STYLES: Record<ProjectStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "bg-gray-500/15 text-gray-700 ring-gray-500/30 dark:text-gray-300",
  },
  in_review: {
    label: "In review",
    className: "bg-amber-500/15 text-amber-800 ring-amber-500/30 dark:text-amber-300",
  },
  approved: {
    label: "Approved",
    className: "bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300",
  },
  shared: {
    label: "Shared",
    className: "bg-sky-500/15 text-sky-800 ring-sky-500/30 dark:text-sky-300",
  },
};

export default function StatusBadge({ status }: { status: ProjectStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}