import type {
  AIStatus, Activity, AnalysisRun, AnalyzeResult, ApplyResult, Dashboard, DocumentItem, DocumentText,
  Handover, KnowledgeCategory, KnowledgeItem, KnowledgeStatus, Member, MemberRole, Project, ProjectStatus,
  Report, ReportDetail, SectionType, User,
} from "./types";

// The backend address comes from NEXT_PUBLIC_API_BASE_URL (see .env.example).
// This must read process.env.NEXT_PUBLIC_API_BASE_URL literally: Next.js replaces
// that exact text with its value while building the site.
// In production the variable is required (scripts/check-env.mjs stops the build
// without it). In development it falls back to the local backend.
const configuredBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");

export const API_BASE_URL: string =
  configuredBaseUrl || (process.env.NODE_ENV === "production" ? "" : "http://localhost:8000");

export const API_PREFIX = "/api/v1";

/** Fired when the server says the session is over, so the app can go to the sign-in page. */
export const UNAUTHORIZED_EVENT = "handoveriq:unauthorized";

export type ApiErrorDetail = { field: string; message: string };

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & { json?: unknown; formData?: FormData };

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);
// Paths where a 401 is an expected answer, not an expired session.
const AUTH_PATHS = ["/auth/login", "/auth/register", "/auth/me", "/auth/logout"];

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  if (!API_BASE_URL) {
    throw new ApiError(0, "not_configured", "The backend address is not configured. Set NEXT_PUBLIC_API_BASE_URL and rebuild the site.");
  }
  const { json, formData, headers: headersInit, method = "GET", ...rest } = options;
  const headers = new Headers(headersInit);
  let body: BodyInit | undefined;
  if (json !== undefined) {
    body = JSON.stringify(json);
    headers.set("Content-Type", "application/json");
  } else if (formData !== undefined) {
    body = formData; // the browser adds the multipart boundary itself
  }
  if (UNSAFE.has(method.toUpperCase())) {
    // Required by the backend on every state-changing request (CSRF protection).
    headers.set("X-Requested-With", "handoveriq");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${API_PREFIX}${path}`, {
      cache: "no-store",
      credentials: "include", // send the HttpOnly session cookie
      ...rest,
      method,
      headers,
      body,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, "network_error", "Cannot reach the HANDOVERIQ server. Check your connection and try again.");
  }

  if (!response.ok) {
    let parsed: { error?: { code?: unknown; message?: unknown; details?: unknown } } | null = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    const error = parsed?.error;
    if (response.status === 401 && !AUTH_PATHS.includes(path) && typeof window !== "undefined") {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }
    throw new ApiError(
      response.status,
      typeof error?.code === "string" ? error.code : "unknown_error",
      typeof error?.message === "string" ? error.message : `Request failed (${response.status}).`,
      error?.details
    );
  }
  return response;
}

async function json<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await request(path, options);
  if (response.status === 204) return undefined as T;
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(response.status, "invalid_response", "The server sent a response that could not be read.");
  }
}

/** The file name from a Content-Disposition header, if there is one. */
export function filenameFromDisposition(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header);
  return plain ? plain[1] : null;
}

/** Downloads a file through the API (so the session cookie is sent) and saves it. */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const response = await request(path);
  const blob = await response.blob();
  const name = filenameFromDisposition(response.headers.get("Content-Disposition")) ?? fallbackName;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Turns the backend's `details` into { field: message }, for showing errors beside inputs. */
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) return result;
  for (const detail of error.details) {
    if (
      typeof detail === "object" && detail !== null &&
      typeof (detail as ApiErrorDetail).field === "string" &&
      typeof (detail as ApiErrorDetail).message === "string" &&
      !Object.prototype.hasOwnProperty.call(result, (detail as ApiErrorDetail).field)
    ) {
      result[(detail as ApiErrorDetail).field] = (detail as ApiErrorDetail).message;
    }
  }
  return result;
}

export function errorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export type HealthResponse = { status: string; service: string; database: string; ai_configured: boolean };

export async function getHealth(): Promise<HealthResponse> {
  if (!API_BASE_URL) throw new ApiError(0, "not_configured", "The backend address is not configured.");
  const response = await fetch(`${API_BASE_URL}/api/health`, { cache: "no-store" });
  return (await response.json()) as HealthResponse;
}

const p = (projectId: number) => `/projects/${projectId}`;

export const api = {
  auth: {
    me: () => json<User>("/auth/me"),
    login: (email: string, password: string) =>
      json<{ user: User }>("/auth/login", { method: "POST", json: { email, password } }),
    register: (full_name: string, email: string, password: string) =>
      json<{ user: User }>("/auth/register", { method: "POST", json: { full_name, email, password } }),
    logout: () => json<void>("/auth/logout", { method: "POST" }),
  },
  users: {
    updateProfile: (full_name: string) => json<User>("/users/me", { method: "PATCH", json: { full_name } }),
    changePassword: (current_password: string, new_password: string) =>
      json<{ user: User }>("/users/me/password", { method: "POST", json: { current_password, new_password } }),
  },
  dashboard: () => json<Dashboard>("/dashboard"),
  projects: {
    list: (params: { search?: string; status?: ProjectStatus | "" } = {}) => {
      const query = new URLSearchParams();
      if (params.search) query.set("search", params.search);
      if (params.status) query.set("status", params.status);
      const suffix = query.toString();
      return json<Project[]>(`/projects${suffix ? `?${suffix}` : ""}`);
    },
    get: (id: number) => json<Project>(p(id)),
    create: (data: { name: string; description?: string | null; status?: ProjectStatus }) =>
      json<Project>("/projects", { method: "POST", json: data }),
    update: (id: number, data: { name?: string; description?: string | null; status?: ProjectStatus }) =>
      json<Project>(p(id), { method: "PATCH", json: data }),
    remove: (id: number) => json<void>(p(id), { method: "DELETE" }),
    activity: (id: number) => json<Activity[]>(`${p(id)}/activity`),
  },
  members: {
    list: (id: number) => json<Member[]>(`${p(id)}/members`),
    add: (id: number, data: { email: string; name?: string; role: MemberRole }) =>
      json<Member>(`${p(id)}/members`, { method: "POST", json: data }),
    changeRole: (id: number, memberId: number, role: MemberRole) =>
      json<Member>(`${p(id)}/members/${memberId}`, { method: "PATCH", json: { role } }),
    remove: (id: number, memberId: number) => json<void>(`${p(id)}/members/${memberId}`, { method: "DELETE" }),
  },
  documents: {
    list: (id: number) => json<DocumentItem[]>(`${p(id)}/documents`),
    upload: (id: number, file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return json<DocumentItem>(`${p(id)}/documents`, { method: "POST", formData });
    },
    text: (id: number, documentId: number) => json<DocumentText>(`${p(id)}/documents/${documentId}/text`),
    download: (id: number, documentId: number, filename: string) =>
      downloadFile(`${p(id)}/documents/${documentId}/download`, filename),
    remove: (id: number, documentId: number) => json<void>(`${p(id)}/documents/${documentId}`, { method: "DELETE" }),
    analyze: (id: number, documentId: number) =>
      json<AnalyzeResult>(`${p(id)}/documents/${documentId}/analyze`, { method: "POST" }),
  },
  handover: {
    get: async (id: number): Promise<Handover | null> => {
      try {
        return await json<Handover>(`${p(id)}/handover`);
      } catch (err) {
        // "No handover yet" is a normal state for a new project, not a failure.
        if (err instanceof ApiError && err.code === "handover_not_found") return null;
        throw err;
      }
    },
    start: (id: number) => json<Handover>(`${p(id)}/handover`, { method: "POST" }),
    updateSection: (id: number, section: SectionType, data: { content?: string; is_complete?: boolean }) =>
      json<Handover>(`${p(id)}/handover/sections/${section}`, { method: "PUT", json: data }),
    submitReview: (id: number) => json<Handover>(`${p(id)}/handover/submit-review`, { method: "POST" }),
    complete: (id: number) => json<Handover>(`${p(id)}/handover/complete`, { method: "POST" }),
    reopen: (id: number) => json<Handover>(`${p(id)}/handover/reopen`, { method: "POST" }),
    acknowledge: (id: number) => json<Handover>(`${p(id)}/handover/acknowledge`, { method: "POST" }),
  },
  knowledge: {
    status: () => json<AIStatus>("/ai/status"),
    list: (id: number, filters: { category?: KnowledgeCategory | ""; status?: KnowledgeStatus | "" } = {}) => {
      const query = new URLSearchParams();
      if (filters.category) query.set("category", filters.category);
      if (filters.status) query.set("status", filters.status);
      const suffix = query.toString();
      return json<KnowledgeItem[]>(`${p(id)}/knowledge${suffix ? `?${suffix}` : ""}`);
    },
    update: (id: number, itemId: number, data: { title?: string; content?: string; status?: KnowledgeStatus }) =>
      json<KnowledgeItem>(`${p(id)}/knowledge/${itemId}`, { method: "PATCH", json: data }),
    remove: (id: number, itemId: number) => json<void>(`${p(id)}/knowledge/${itemId}`, { method: "DELETE" }),
    apply: (id: number, itemIds?: number[]) =>
      json<ApplyResult>(`${p(id)}/knowledge/apply`, { method: "POST", json: itemIds ? { item_ids: itemIds } : {} }),
    runs: (id: number) => json<AnalysisRun[]>(`${p(id)}/analysis-runs`),
  },
  reports: {
    list: (id: number) => json<Report[]>(`${p(id)}/reports`),
    get: (id: number, reportId: number) => json<ReportDetail>(`${p(id)}/reports/${reportId}`),
    create: (id: number, title?: string) =>
      json<Report>(`${p(id)}/reports`, { method: "POST", json: title ? { title } : {} }),
    download: (id: number, reportId: number, format: "pdf" | "md", fallbackName: string) =>
      downloadFile(`${p(id)}/reports/${reportId}/export?format=${format}`, fallbackName),
  },
};
