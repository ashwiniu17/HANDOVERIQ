import { apiFetch } from "./api";

export const PROJECT_STATUSES = [
  "draft",
  "in_review",
  "approved",
  "shared",
] as const;

/** Set by the server only. It can never be sent when creating or editing. */
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** A project exactly as the API returns it (backend schema: ProjectRead). */
export type Project = {
  id: number;
  name: string;
  description: string | null;
  outgoing_member: string;
  incoming_member: string;
  status: ProjectStatus;
  /** ISO 8601 UTC timestamp, for example "2026-11-01T10:00:00Z". */
  created_at: string;
  updated_at: string;
};

/** The four editable fields (backend schemas: ProjectCreate and ProjectUpdate). */
export type ProjectInput = {
  name: string;
  description?: string | null;
  outgoing_member: string;
  incoming_member: string;
};

export type ProjectCreateInput = ProjectInput;
export type ProjectUpdateInput = ProjectInput;

const PROJECTS_PATH = "/api/projects";

function projectPath(id: number): string {
  return `${PROJECTS_PATH}/${id}`;
}

// Build the request body from exactly the four editable fields. Even if extra
// properties (such as "status") reach this function from untyped code, they are
// never sent. A missing description is sent as null: PUT replaces all fields.
function toRequestBody(data: ProjectInput) {
  return {
    name: data.name,
    description: data.description ?? null,
    outgoing_member: data.outgoing_member,
    incoming_member: data.incoming_member,
  };
}

export function listProjects(signal?: AbortSignal): Promise<Project[]> {
  return apiFetch<Project[]>(PROJECTS_PATH, { signal });
}

export function getProject(id: number, signal?: AbortSignal): Promise<Project> {
  return apiFetch<Project>(projectPath(id), { signal });
}

export function createProject(data: ProjectCreateInput): Promise<Project> {
  return apiFetch<Project>(PROJECTS_PATH, {
    method: "POST",
    json: toRequestBody(data),
  });
}

export function updateProject(
  id: number,
  data: ProjectUpdateInput
): Promise<Project> {
  return apiFetch<Project>(projectPath(id), {
    method: "PUT",
    json: toRequestBody(data),
  });
}

/** Resolves with nothing: the server answers 204 No Content. */
export function deleteProject(id: number): Promise<void> {
  return apiFetch<void>(projectPath(id), { method: "DELETE" });
}