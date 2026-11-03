
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "https://handoveriq-backend.onrender.com";

/** One entry of `details` in the backend's error format. */
export type ApiErrorDetail = { field: string; message: string };

type ApiErrorBody = {
  error?: { code?: unknown; message?: unknown; details?: unknown };
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

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  /** Sent as the JSON request body, with "Content-Type: application/json". */
  json?: unknown;
};

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  const { json, headers: headersInit, ...rest } = options;

  const headers = new Headers(headersInit);
  let body: string | undefined;
  if (json !== undefined) {
    body = JSON.stringify(json);
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    // Never serve cached data: a list must always reflect the database.
    response = await fetch(`${API_BASE_URL}${path}`, {
      cache: "no-store",
      ...rest,
      headers,
      body,
    });
  } catch (err) {
    // A request cancelled on purpose (AbortController) is not a network problem.
    if (err instanceof DOMException && err.name === "AbortError") {
      throw err;
    }
    throw new ApiError(
      0,
      "network_error",
      "Cannot reach the HANDOVERIQ server. Check that the backend is running."
    );
  }

  if (!response.ok) {
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      parsed = null;
    }
    const error = parsed?.error;
    throw new ApiError(
      response.status,
      typeof error?.code === "string" ? error.code : "unknown_error",
      typeof error?.message === "string"
        ? error.message
        : `Request failed with status ${response.status}.`,
      error?.details
    );
  }

  // 204 No Content (our DELETE) has no body, so there is nothing to parse.
  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      response.status,
      "invalid_response",
      "The server sent a response that could not be read."
    );
  }
}

function isErrorDetail(value: unknown): value is ApiErrorDetail {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return typeof item.field === "string" && typeof item.message === "string";
}

/**
 * Turns the backend's `details` into { fieldName: message }, so a form can show
 * each message next to its input. Returns {} for anything that is not an ApiError
 * with field details. If a field has several messages, the first one is kept.
 */
export function getFieldErrors(error: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) {
    return result;
  }
  for (const detail of error.details) {
    if (
      isErrorDetail(detail) &&
      !Object.prototype.hasOwnProperty.call(result, detail.field)
    ) {
      result[detail.field] = detail.message;
    }
  }
  return result;
}

export type HealthResponse = {
  status: string;
  service: string;
  anthropic_configured: boolean;
};

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>("/api/health", { cache: "no-store" });
}
