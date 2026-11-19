import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Field";
import { Markdown, parseBlocks } from "@/components/ui/Markdown";
import { Quote } from "@/components/ui/Quote";
import { ToastProvider, useToast } from "@/components/ui/Toast";
import { useResource } from "@/lib/hooks";

afterEach(() => {
  vi.useRealTimers();
});

describe("Button", () => {
  it("fires clicks", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and busy while loading, so it cannot be double-submitted", async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not submit forms unless asked to", () => {
    expect(render(<Button>Plain</Button>).getByRole("button").getAttribute("type")).toBe("button");
  });
});

describe("Input", () => {
  it("connects the label, hint and error for screen readers", () => {
    render(<Input label="E-mail" hint="We never share it." error="Enter a valid e-mail address." />);
    const input = screen.getByLabelText("E-mail");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe("Enter a valid e-mail address.");
    expect(input.getAttribute("aria-describedby")).toContain(alert.id);
  });

  it("shows the hint when there is no error, and marks optional fields", () => {
    render(<Input label="Name" optional hint="Only used for invitations." />);
    expect(screen.getByText("Only used for invitations.")).toBeTruthy();
    expect(screen.getByText("Optional")).toBeTruthy();
    expect(screen.getByLabelText(/Name/).getAttribute("aria-invalid")).toBeNull();
  });
});

function ToastDemo() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Saved it")}>ok</button>
      <button onClick={() => toast.error("Broke it")}>bad</button>
    </>
  );
}

describe("Toast", () => {
  it("announces success politely and errors as alerts", async () => {
    render(<ToastProvider><ToastDemo /></ToastProvider>);
    await userEvent.click(screen.getByText("ok"));
    await userEvent.click(screen.getByText("bad"));
    expect(screen.getByRole("status").textContent).toContain("Saved it");
    expect(screen.getByRole("alert").textContent).toContain("Broke it");
  });

  it("disappears by itself, errors a little later than successes", () => {
    vi.useFakeTimers();
    render(<ToastProvider duration={1000}><ToastDemo /></ToastProvider>);
    fireEvent.click(screen.getByText("ok"));
    fireEvent.click(screen.getByText("bad"));
    expect(screen.getByText("Saved it")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByText("Saved it")).toBeNull();
    expect(screen.getByText("Broke it")).toBeTruthy();
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.queryByText("Broke it")).toBeNull();
  });

  it("can be dismissed by hand", async () => {
    render(<ToastProvider><ToastDemo /></ToastProvider>);
    await userEvent.click(screen.getByText("ok"));
    await userEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));
    expect(screen.queryByText("Saved it")).toBeNull();
  });
});

describe("Dialog", () => {
  it("opens with its title and closes from the close button", async () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Edit project"><p>Body</p></Dialog>);
    const dialog = screen.getByRole("dialog", { hidden: true }) as HTMLDialogElement;
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(dialog.getAttribute("aria-labelledby")).toBeTruthy();
    expect(screen.getByText("Edit project")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes when the dimmed backdrop is clicked", () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="T"><p>Body</p></Dialog>);
    fireEvent.click(screen.getByRole("dialog", { hidden: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it("renders nothing inside while closed", () => {
    render(<Dialog open={false} onClose={() => {}} title="Hidden"><p>Secret body</p></Dialog>);
    expect(screen.queryByText("Secret body")).toBeNull();
  });
});

describe("ConfirmDialog", () => {
  it("confirms and cancels", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Delete?" message="Gone forever" confirmLabel="Delete it" onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete it" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cannot be dismissed while the action is running", async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog open busy title="Delete?" message="x" confirmLabel="Delete it" onConfirm={() => {}} onCancel={onCancel} />);
    expect((screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("dialog", { hidden: true })); // backdrop
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("Markdown", () => {
  it("groups bullet and numbered lines into lists", () => {
    expect(parseBlocks("Intro\n- one\n- two\n\n1. first\n2) second\nEnd")).toEqual([
      { type: "p", text: "Intro" },
      { type: "ul", items: ["one", "two"] },
      { type: "ol", items: ["first", "second"] },
      { type: "p", text: "End" },
    ]);
  });

  it("renders bold and code", () => {
    const { container } = render(<Markdown content={"- Use **Python** and `make dev`"} />);
    expect(container.querySelector("strong")?.textContent).toBe("Python");
    expect(container.querySelector("code")?.textContent).toBe("make dev");
    expect(container.querySelectorAll("li")).toHaveLength(1);
  });

  it("never turns text into HTML", () => {
    const { container } = render(<Markdown content={'<img src=x onerror="alert(1)"> and <script>alert(2)</script>'} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(2)</script>");
  });
});

describe("Quote", () => {
  it("highlights a verified quote", () => {
    const { container } = render(<Quote text="Finish the export" source="notes.txt" verified />);
    expect(container.querySelector(".mark")?.textContent).toContain("Finish the export");
    expect(screen.queryByText(/Not found in the document/)).toBeNull();
  });

  it("warns, without highlighting, when the quote is not in the document", () => {
    const { container } = render(<Quote text="Rewrite everything" source="notes.txt" verified={false} />);
    expect(container.querySelector(".mark")).toBeNull();
    expect(screen.getByText(/Not found in the document/)).toBeTruthy();
  });
});

function ResourceDemo({ loader }: { loader: () => Promise<string> }) {
  const { data, error, loading, reload } = useResource(loader, "k");
  return (
    <div>
      <p data-testid="state">{loading ? "loading" : error ? `error:${error.message}` : `data:${data}`}</p>
      <button onClick={reload}>reload</button>
    </div>
  );
}

describe("useResource", () => {
  it("loads, then keeps showing the old data while reloading", async () => {
    let n = 0;
    const loader = vi.fn(() => Promise.resolve(`v${++n}`));
    render(<ResourceDemo loader={loader} />);
    expect(screen.getByTestId("state").textContent).toBe("loading");
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("data:v1"));
    await userEvent.click(screen.getByText("reload"));
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("data:v2"));
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it("reports failures", async () => {
    render(<ResourceDemo loader={() => Promise.reject(new Error("nope"))} />);
    await waitFor(() => expect(screen.getByTestId("state").textContent).toBe("error:nope"));
  });

  it("ignores an answer that arrives after the component is gone", async () => {
    let resolve: (v: string) => void = () => {};
    const { unmount } = render(<ResourceDemo loader={() => new Promise<string>((r) => { resolve = r; })} />);
    unmount();
    await act(async () => { resolve("late"); });
    // nothing to assert beyond "no state-update-on-unmounted warning or crash"
    expect(true).toBe(true);
  });
});

describe("controlled state in dialogs", () => {
  it("can be reopened after closing", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>open</button>
          <Dialog open={open} onClose={() => setOpen(false)} title="Again"><p>Content</p></Dialog>
        </>
      );
    }
    render(<Harness />);
    await userEvent.click(screen.getByText("open"));
    expect(screen.getByText("Content")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("Content")).toBeNull());
    await userEvent.click(screen.getByText("open"));
    expect(screen.getByText("Content")).toBeTruthy();
  });
});
