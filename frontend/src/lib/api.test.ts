import { beforeEach, describe, expect, it, vi } from "vitest";

// api.ts reads its settings when first loaded, so tests that change the
// environment load a fresh copy of the module.
async function loadApi(env: Record<string, string> = { NEXT_PUBLIC_API_BASE_URL: "https://api.example.com" }) {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return import("./api");
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("base URL", () => {
  it("uses NEXT_PUBLIC_API_BASE_URL and strips trailing slashes", async () => {
    const { API_BASE_URL } = await loadApi({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.com//" });
    expect(API_BASE_URL).toBe("https://api.example.com");
  });

  it("falls back to localhost in development", async () => {
    const { API_BASE_URL } = await loadApi({ NEXT_PUBLIC_API_BASE_URL: "", NODE_ENV: "development" });
    expect(API_BASE_URL).toBe("http://localhost:8000");
  });

  it("never guesses an address in production", async () => {
    const { API_BASE_URL, api } = await loadApi({ NEXT_PUBLIC_API_BASE_URL: "", NODE_ENV: "production" });
    expect(API_BASE_URL).toBe("");
    await expect(api.dashboard()).rejects.toMatchObject({ code: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("requests", () => {
  it("sends the session cookie and calls the versioned API", async () => {
    fetchMock.mockResolvedValue(json([]));
    const { api } = await loadApi();
    await api.projects.list();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v1/projects");
    expect(init.credentials).toBe("include");
  });

  it("adds the CSRF header only to state-changing requests", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json({ id: 1 }, 201)));
    const { api } = await loadApi();
    await api.projects.list();
    await api.projects.create({ name: "Atlas" });
    const [, getInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [, postInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(new Headers(getInit.headers).has("X-Requested-With")).toBe(false);
    expect(new Headers(postInit.headers).get("X-Requested-With")).toBe("handoveriq");
    expect(new Headers(postInit.headers).get("Content-Type")).toBe("application/json");
    expect(postInit.body).toBe(JSON.stringify({ name: "Atlas" }));
  });

  it("uploads files as multipart form data under the name 'file'", async () => {
    fetchMock.mockResolvedValue(json({ id: 1 }, 201));
    const { api } = await loadApi();
    await api.documents.upload(5, new File(["hello"], "notes.txt"));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/v1/projects/5/documents");
    expect((init.body as FormData).get("file")).toBeInstanceOf(File);
    expect(new Headers(init.headers).has("Content-Type")).toBe(false); // the browser adds the boundary
  });

  it("returns undefined for 204 responses", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { api } = await loadApi();
    await expect(api.projects.remove(1)).resolves.toBeUndefined();
  });

  it("builds query strings only from filled-in filters", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(json([])));
    const { api } = await loadApi();
    await api.projects.list({ search: "atlas billing", status: "" });
    await api.knowledge.list(1, { category: "decision", status: "accepted" });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://api.example.com/api/v1/projects?search=atlas+billing");
    expect((fetchMock.mock.calls[1] as [string])[0]).toBe("https://api.example.com/api/v1/projects/1/knowledge?category=decision&status=accepted");
  });
});

describe("errors", () => {
  it("turns the backend's error format into an ApiError", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "role_taken", message: "Already has one.", details: [{ field: "role", message: "Taken." }] } }, 409));
    const { api, ApiError, getFieldErrors } = await loadApi();
    const failure = await api.members.add(1, { email: "a@b.co", role: "outgoing" }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ status: 409, code: "role_taken", message: "Already has one." });
    expect(getFieldErrors(failure)).toEqual({ role: "Taken." });
  });

  it("copes with a non-JSON error body", async () => {
    fetchMock.mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    const { api } = await loadApi();
    await expect(api.dashboard()).rejects.toMatchObject({ status: 502, code: "unknown_error" });
  });

  it("reports an unreachable server as network_error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const { api } = await loadApi();
    await expect(api.dashboard()).rejects.toMatchObject({ status: 0, code: "network_error" });
  });

  it("lets a deliberate cancel through untouched", async () => {
    fetchMock.mockRejectedValue(new DOMException("x", "AbortError"));
    const { api } = await loadApi();
    await expect(api.dashboard()).rejects.toMatchObject({ name: "AbortError" });
  });

  it("announces an ended session, but not for sign-in attempts", async () => {
    const { api, UNAUTHORIZED_EVENT } = await loadApi();
    const listener = vi.fn();
    window.addEventListener(UNAUTHORIZED_EVENT, listener);
    fetchMock.mockResolvedValue(json({ error: { code: "not_authenticated", message: "Sign in." } }, 401));

    await api.dashboard().catch(() => undefined);
    expect(listener).toHaveBeenCalledTimes(1);

    await api.auth.login("a@b.co", "wrong").catch(() => undefined);
    await api.auth.me().catch(() => undefined);
    expect(listener).toHaveBeenCalledTimes(1); // expected 401s do not log anyone out
    window.removeEventListener(UNAUTHORIZED_EVENT, listener);
  });

  it("getFieldErrors keeps the first message per field and ignores other errors", async () => {
    const { ApiError, getFieldErrors } = await loadApi();
    const error = new ApiError(422, "validation_error", "Invalid", [
      { field: "name", message: "Required." }, { field: "name", message: "Too short." }, { nonsense: true },
    ]);
    expect(getFieldErrors(error)).toEqual({ name: "Required." });
    expect(getFieldErrors(new Error("x"))).toEqual({});
  });
});

describe("handover.get", () => {
  it("returns the handover when there is one", async () => {
    fetchMock.mockResolvedValue(json({ id: 3, status: "draft" }));
    const { api } = await loadApi();
    await expect(api.handover.get(1)).resolves.toMatchObject({ id: 3 });
  });

  it("returns null, not an error, before a handover is started", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "handover_not_found", message: "None yet." } }, 404));
    const { api } = await loadApi();
    await expect(api.handover.get(1)).resolves.toBeNull();
  });

  it("still reports a missing project", async () => {
    fetchMock.mockResolvedValue(json({ error: { code: "project_not_found", message: "No." } }, 404));
    const { api } = await loadApi();
    await expect(api.handover.get(1)).rejects.toMatchObject({ code: "project_not_found" });
  });
});

describe("downloads", () => {
  it("reads file names from Content-Disposition, including non-ASCII ones", async () => {
    const { filenameFromDisposition } = await loadApi();
    expect(filenameFromDisposition(`attachment; filename="a.pdf"; filename*=UTF-8''Spec%20%C3%BC.pdf`)).toBe("Spec ü.pdf");
    expect(filenameFromDisposition('attachment; filename="plain.md"')).toBe("plain.md");
    expect(filenameFromDisposition(null)).toBeNull();
  });

  it("saves the downloaded file under the server's name", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-", { status: 200, headers: { "Content-Disposition": 'attachment; filename="r-v1.pdf"' } }));
    const createObjectURL = vi.fn(() => "blob:x");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
    let saved = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved = this.download;
    });
    const { api } = await loadApi();
    await api.reports.download(1, 2, "pdf", "fallback.pdf");
    expect(saved).toBe("r-v1.pdf");
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe("https://api.example.com/api/v1/projects/1/reports/2/export?format=pdf");
    expect(revokeObjectURL).toHaveBeenCalled();
    click.mockRestore();
  });
});
