import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { formatDateTime, lowerFirst, timeAgo } from "@/lib/format";
import type { Activity } from "@/lib/types";

export function ActivityFeed({ items, showProject = false }: { items: Activity[]; showProject?: boolean }) {
  return (
    <ol className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 py-3">
          <Avatar name={item.actor_name} />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug text-ink">
              <span className="font-semibold">{item.actor_name}</span>{" "}
              <span className="text-ink-soft">{lowerFirst(item.message)}</span>
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {showProject && item.project_name && (
                <>
                  <Link href={`/app/projects/${item.project_id}`} className="font-medium text-brand-ink hover:underline">{item.project_name}</Link>
                  {" · "}
                </>
              )}
              <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>{timeAgo(item.created_at)}</time>
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
