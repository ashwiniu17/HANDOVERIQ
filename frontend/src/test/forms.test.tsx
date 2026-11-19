import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/features/ProjectForm";
import { ApiError } from "@/lib/api";

describe("ProjectForm", () => {
  it("requires a name and does not submit without one", async () => {
    const onSubmit = vi.fn();
    render(<ProjectForm submitLabel="Create project" onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(screen.getByText("Enter a project name.")).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits trimmed values, with an empty description as null", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ProjectForm submitLabel="Create project" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Project name"), "  Atlas  ");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "on_hold");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Atlas", description: null, status: "on_hold" }));
  });

  it("pre-fills when editing", () => {
    render(<ProjectForm submitLabel="Save" initial={{ name: "Atlas", description: "Billing", status: "completed" }} onSubmit={vi.fn()} />);
    expect((screen.getByLabelText("Project name") as HTMLInputElement).value).toBe("Atlas");
    expect((screen.getByLabelText(/Description/) as HTMLTextAreaElement).value).toBe("Billing");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("completed");
  });

  it("shows the server's field errors beside the field", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(422, "validation_error", "Invalid", [{ field: "name", message: "That name is not allowed." }]));
    render(<ProjectForm submitLabel="Create project" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Project name"), "Atlas");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("That name is not allowed.")).toBeTruthy();
  });

  it("shows other failures as a message and lets the user try again", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(0, "network_error", "Cannot reach the HANDOVERIQ server."));
    render(<ProjectForm submitLabel="Create project" onSubmit={onSubmit} />);
    await userEvent.type(screen.getByLabelText("Project name"), "Atlas");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Cannot reach");
    expect((screen.getByRole("button", { name: "Create project" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
