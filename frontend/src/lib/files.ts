export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt", ".md"];
// Matches the backend's default. The server stays the authority on the real limit.
export const MAX_UPLOAD_MB = 10;

/** A message if the browser can already tell the file will be refused, otherwise null. */
export function checkFile(file: Pick<File, "name" | "size">): string | null {
  const extension = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
  if (!ACCEPTED_EXTENSIONS.includes(extension)) return "Only PDF, Word (.docx), text (.txt) and Markdown (.md) files are supported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_UPLOAD_MB * 1024 * 1024) return `Files can be at most ${MAX_UPLOAD_MB} MB.`;
  return null;
}
