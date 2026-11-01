export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ApiErrorBody = {
  error?: { code?: string; message?: string; details?: unknown };
};

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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init);
  } catch {
    throw new ApiError(
      0,
      "network_error",
      "Cannot reach the HANDOVERIQ server. Check that the backend is running."
    );
  }

  if (!response.ok) {
    let body: ApiErrorBody | null = null;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = null;
    }
    throw new ApiError(
      response.status,
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? `Request failed with status ${response.status}.`,
      body?.error?.details
    );
  }

  return (await response.json()) as T;
}

export type HealthResponse = {
  status: string;
  service: string;
  anthropic_configured: boolean;
};

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health", { cache: "no-store" });
}