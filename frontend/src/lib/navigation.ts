/**
 * Where to go after signing in. Only ever a page inside the app: a link such as
 * /login?next=https://evil.example must never send the user to another website.
 */
export function safeNext(value: string | null): string {
  if (!value) return "/app";
  if (!value.startsWith("/app")) return "/app";
  if (value.includes("//") || value.includes("\\") || value.includes("://")) return "/app";
  return value;
}
