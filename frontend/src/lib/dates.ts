function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** For example "Nov 1, 2026", in the visitor's own locale. */
export function formatDate(iso: string): string {
  const date = parseDate(iso);
  if (!date) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

/** For example "Nov 1, 2026, 3:30 PM", in the visitor's own locale and time zone. */
export function formatDateTime(iso: string): string {
  const date = parseDate(iso);
  if (!date) return "Unknown date";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}