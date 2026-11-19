import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const replace = vi.fn();
let search = "";
let path = "/app/projects/3";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(search),
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...original,
    api: { ...original.api, auth: { me: vi.fn(), login: vi.fn(), register: vi.fn(), logout: vi.fn() } },
  };
});

import LoginPage from "@/app/(auth)/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import { AuthGate } from "@/components/layout/AuthGate";
import { ToastProvider } from "@/components/ui/Toast";
import { ApiError, api } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";

const user = { id: 1, email: "a@example.com", full_name: "Ada Lovelace", created_at: "2026-01-01T00:00:00Z" };
const me = vi.mocked(api.auth.me);
const login = vi.mocked(api.auth.login);
const register = vi.mocked(api.auth.register);

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider><AuthProvider>{ui}</AuthProvider></ToastProvider>);
}

beforeEach(() => {
  replace.mockReset();
  me.mockReset();
  login.mockReset();
  register.mockReset();
  search = "";
  path = "/app/projects/3";
});

describe("AuthGate", () => {
  it("sends signed-out visitors to the sign-in page and remembers where they were going", async () => {
    me.mockRejectedValue(new ApiError(401, "not_authenticated", "Sign in."));
    renderWithProviders(<AuthGate><p>Secret dashboard</p></AuthGate>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?next=%2Fapp%2Fprojects%2F3"));
    expect(screen.queryByText("Secret dashboard")).toBeNull();
  });

  it("shows the app to a signed-in user", async () => {
    me.mockResolvedValue(user);
    renderWithProviders(<AuthGate><p>Secret dashboard</p></AuthGate>);
    expect(await screen.findByText("Secret dashboard")).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("does not claim 'sign in' when the server is simply unreachable", async () => {
    me.mockRejectedValue(new ApiError(0, "network_error", "Cannot reach the HANDOVERIQ server."));
    renderWithProviders(<AuthGate><p>Secret dashboard</p></AuthGate>);
    expect(await screen.findByText("Cannot reach the HANDOVERIQ server.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it("recovers when the server comes back", async () => {
    me.mockRejectedValueOnce(new ApiError(0, "network_error", "Cannot reach the HANDOVERIQ server."));
    me.mockResolvedValue(user);
    renderWithProviders(<AuthGate><p>Secret dashboard</p></AuthGate>);
    await userEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Secret dashboard")).toBeTruthy();
  });
});

describe("Login page", () => {
  beforeEach(() => {
    me.mockRejectedValue(new ApiError(401, "not_authenticated", "Sign in."));
  });

  it("checks the form before bothering the server", async () => {
    renderWithProviders(<LoginPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(screen.getByText("Enter your e-mail address.")).toBeTruthy();
    expect(screen.getByText("Enter your password.")).toBeTruthy();
    expect(login).not.toHaveBeenCalled();
  });

  it("signs in and goes to the dashboard", async () => {
    login.mockResolvedValue({ user });
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText("E-mail"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
    expect(login).toHaveBeenCalledWith("a@example.com", "correct-horse-battery");
  });

  it("returns to the page the visitor was heading for", async () => {
    search = "next=%2Fapp%2Fprojects%2F3%2Fhandover";
    login.mockResolvedValue({ user });
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText("E-mail"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app/projects/3/handover"));
  });

  it("will not be tricked into leaving the site", async () => {
    search = "next=https%3A%2F%2Fevil.example";
    login.mockResolvedValue({ user });
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText("E-mail"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "x");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
  });

  it("shows the server's message for wrong credentials and lets the user retry", async () => {
    login.mockRejectedValue(new ApiError(401, "invalid_credentials", "The e-mail or password is not correct."));
    renderWithProviders(<LoginPage />);
    await userEvent.type(await screen.findByLabelText("E-mail"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect((await screen.findByRole("alert")).textContent).toContain("The e-mail or password is not correct.");
    expect((screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement).disabled).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("skips the form for someone who is already signed in", async () => {
    me.mockReset();
    me.mockResolvedValue(user);
    renderWithProviders(<LoginPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
  });
});

describe("Register page", () => {
  beforeEach(() => {
    me.mockRejectedValue(new ApiError(401, "not_authenticated", "Sign in."));
  });

  it("validates name, e-mail and password", async () => {
    renderWithProviders(<RegisterPage />);
    await userEvent.type(await screen.findByLabelText("E-mail"), "nope");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getByText("Enter your name.")).toBeTruthy();
    expect(screen.getByText("Enter a valid e-mail address.")).toBeTruthy();
    expect(screen.getByText("Use at least 8 characters.")).toBeTruthy();
    expect(register).not.toHaveBeenCalled();
  });

  it("creates the account and enters the app", async () => {
    register.mockResolvedValue({ user });
    renderWithProviders(<RegisterPage />);
    await userEvent.type(await screen.findByLabelText("Full name"), "Ada Lovelace");
    await userEvent.type(screen.getByLabelText("E-mail"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/app"));
    expect(register).toHaveBeenCalledWith("Ada Lovelace", "a@example.com", "correct-horse-battery");
  });

  it("shows 'e-mail already used' next to the e-mail field", async () => {
    register.mockRejectedValue(new ApiError(409, "email_taken", "An account with this e-mail address already exists. Sign in instead."));
    renderWithProviders(<RegisterPage />);
    await userEvent.type(await screen.findByLabelText("Full name"), "Ada");
    await userEvent.type(screen.getByLabelText("E-mail"), "a@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("already exists");
    expect(screen.getByLabelText("E-mail").getAttribute("aria-invalid")).toBe("true");
  });
});
