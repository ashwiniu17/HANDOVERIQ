import type {
  AccessRole, AnalysisStatus, Confidence, HandoverStatus, KnowledgeCategory, KnowledgeStatus,
  ProcessingStatus, ProjectStatus, SectionType,
} from "./types";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
});

export function formatDate(value: string | null | undefined): string {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

/** "5 minutes ago", "yesterday", or the date for anything older than a week. */
export function timeAgo(value: string, now: Date = new Date()): string {
  const seconds = Math.round((now.getTime() - new Date(value).getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24); // 36 hours ago is still "yesterday"
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
}

/** "Created the project" -> "created the project", but "AI analyzed" stays "AI analyzed". */
export function lowerFirst(text: string): string {
  if (!text) return text;
  const second = text.charAt(1);
  const startsWithAcronym = second !== "" && second === second.toUpperCase() && second !== second.toLowerCase();
  return startsWithAcronym ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
};

export const ROLE_LABEL: Record<AccessRole, string> = {
  owner: "Owner",
  outgoing: "Outgoing member",
  incoming: "Incoming member",
  collaborator: "Collaborator",
};

export const ROLE_HELP: Record<AccessRole, string> = {
  owner: "Created the project. Can do everything, including managing members and deleting it.",
  outgoing: "Is leaving the project. Writes the handover, uploads documents and reviews the AI's findings.",
  incoming: "Is taking over. Can read everything and confirms receipt once the handover is completed.",
  collaborator: "Helps prepare the handover. Can edit, but cannot manage members or delete the project.",
};

export const HANDOVER_STATUS_LABEL: Record<HandoverStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  completed: "Completed",
};

export const PROCESSING_LABEL: Record<ProcessingStatus, string> = {
  processing: "Reading…",
  processed: "Text extracted",
  failed: "Could not read",
};

export const ANALYSIS_LABEL: Record<AnalysisStatus, string> = {
  not_analyzed: "Not analyzed",
  analyzing: "Analyzing…",
  analyzed: "Analyzed",
  failed: "Analysis failed",
};

export const CATEGORY_LABEL: Record<KnowledgeCategory, string> = {
  summary: "Summary",
  technical_requirement: "Technical",
  completed_task: "Completed task",
  pending_task: "Pending task",
  decision: "Decision",
  dependency: "Dependency",
  known_issue: "Known issue",
  setup_step: "Setup",
  recommendation: "Recommendation",
};

export const CATEGORY_TO_SECTION: Record<KnowledgeCategory, SectionType> = {
  summary: "overview",
  technical_requirement: "technical",
  completed_task: "completed_tasks",
  pending_task: "pending_tasks",
  decision: "decisions",
  dependency: "dependencies",
  known_issue: "known_issues",
  setup_step: "setup",
  recommendation: "recommendations",
};

export const KNOWLEDGE_STATUS_LABEL: Record<KnowledgeStatus, string> = {
  suggested: "To review",
  accepted: "Accepted",
  edited: "Edited",
  rejected: "Rejected",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: "Stated directly",
  medium: "Likely",
  low: "Hinted at",
};
