import { describe, expect, it } from "vitest";
import { checkFile } from "./files";
import { formatBytes, initials, lowerFirst, timeAgo } from "./format";
import { buildSteps } from "./journey";
import { safeNext } from "./navigation";
import { firstError, validateEmail, validatePassword, validateRequired } from "./validation";
import type { Handover, KnowledgeItem, Member } from "./types";

describe("safeNext (open-redirect guard)", () => {
  it("allows pages inside the app", () => {
    expect(safeNext("/app")).toBe("/app");
    expect(safeNext("/app/projects/3/handover")).toBe("/app/projects/3/handover");
    expect(safeNext("/app/projects?x=1")).toBe("/app/projects?x=1");
  });

  it.each([
    null, "", "/", "/login", "https://evil.example", "//evil.example", "/app//evil.example/../..",
    "/app\\@evil.example", "/app/redirect?to=https://evil.example", "javascript:alert(1)", "app/projects",
  ])("falls back to the dashboard for %s", (value) => {
    expect(safeNext(value)).toBe("/app");
  });
});

describe("validation", () => {
  it("validates e-mail addresses", () => {
    expect(validateEmail("")).toBeTruthy();
    expect(validateEmail("nope")).toBeTruthy();
    expect(validateEmail("a@b")).toBeTruthy();
    expect(validateEmail(" a@example.com ")).toBeNull();
  });
  it("validates passwords", () => {
    expect(validatePassword("")).toBeTruthy();
    expect(validatePassword("short")).toBeTruthy();
    expect(validatePassword("x".repeat(129))).toBeTruthy();
    expect(validatePassword("long enough phrase")).toBeNull();
  });
  it("validates required text", () => {
    expect(validateRequired("   ", "a name")).toBe("Enter a name.");
    expect(validateRequired("x".repeat(121), "a name")).toBeTruthy();
    expect(validateRequired("Atlas", "a name")).toBeNull();
  });
  it("firstError drops empty entries", () => {
    expect(firstError({ a: null, b: "Bad", c: "" })).toEqual({ b: "Bad" });
  });
});

describe("checkFile", () => {
  it("accepts supported files and refuses the rest before upload", () => {
    expect(checkFile({ name: "a.PDF", size: 10 })).toBeNull();
    expect(checkFile({ name: "a.docx", size: 10 })).toBeNull();
    expect(checkFile({ name: "a.md", size: 10 })).toBeNull();
    expect(checkFile({ name: "a.csv", size: 10 })).toMatch(/Only PDF/);
    expect(checkFile({ name: "noext", size: 10 })).toMatch(/Only PDF/);
    expect(checkFile({ name: "a.txt", size: 0 })).toMatch(/empty/);
    expect(checkFile({ name: "a.txt", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });
});

describe("formatting", () => {
  it("formats sizes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(300 * 1024)).toBe("300 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
  it("lower-cases a sentence start for the activity feed, but keeps acronyms", () => {
    expect(lowerFirst("Created the project.")).toBe("created the project.");
    expect(lowerFirst("AI analyzed “notes.txt”.")).toBe("AI analyzed “notes.txt”.");
    expect(lowerFirst("PDF uploaded")).toBe("PDF uploaded");
    expect(lowerFirst("A")).toBe("a");
    expect(lowerFirst("")).toBe("");
  });
  it("makes initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("  madonna ")).toBe("M");
    expect(initials("")).toBe("?");
  });
  it("describes elapsed time", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();
    expect(timeAgo(ago(10_000), now)).toBe("just now");
    expect(timeAgo(ago(5 * 60_000), now)).toBe("5 minutes ago");
    expect(timeAgo(ago(60_000 * 60), now)).toBe("1 hour ago");
    expect(timeAgo(ago(36 * 3600_000), now)).toBe("yesterday");
    expect(timeAgo(ago(3 * 86400_000), now)).toBe("3 days ago");
    expect(timeAgo(ago(30 * 86400_000), now)).toMatch(/2026/);
  });
});

describe("buildSteps (the overview checklist)", () => {
  const member = (role: Member["role"]): Member => ({ id: 1, name: "X", email: "x@example.com", role, is_owner: false, has_account: true, created_at: "" });
  const item = (status: KnowledgeItem["status"]) => ({ status }) as KnowledgeItem;
  const handover = (over: Partial<Handover>) => ({ completed_sections: 3, total_sections: 9, status: "draft", acknowledged_at: null, ...over }) as Handover;
  const base = { base: "/app/projects/1", members: [] as Member[], documentCount: 0, knowledge: [] as KnowledgeItem[], aiConfigured: true, handover: null };

  it("starts with everything still to do", () => {
    const steps = buildSteps(base);
    expect(steps).toHaveLength(5);
    expect(steps.every((s) => !s.done)).toBe(true);
    expect(steps[0].detail).toContain("an outgoing member and an incoming member");
  });

  it("marks steps done from real data", () => {
    const steps = buildSteps({
      ...base,
      members: [member("outgoing"), member("incoming")],
      documentCount: 2,
      knowledge: [item("accepted"), item("rejected")],
      handover: handover({ status: "completed", acknowledged_at: "2026-06-01T00:00:00Z" }),
    });
    expect(steps.map((s) => s.done)).toEqual([true, true, true, true, true]);
  });

  it("is not done while findings still wait for a decision", () => {
    const steps = buildSteps({ ...base, knowledge: [item("accepted"), item("suggested")] });
    expect(steps[2].done).toBe(false);
    expect(steps[2].detail).toContain("1 item waiting");
  });

  it("says plainly when AI is not set up", () => {
    expect(buildSteps({ ...base, aiConfigured: false })[2].detail).toContain("not set up");
  });
});
