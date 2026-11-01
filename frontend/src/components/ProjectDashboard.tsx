"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "../lib/api";
import { listProjects, type Project } from "../lib/projects";
import { PRIMARY_BUTTON } from "./buttonStyles";
import ProjectForm from "./ProjectForm";
import ProjectList from "./ProjectList";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; projects: Project[] };

/**
 * A request to (re)load the list. Each new object triggers one new load and
 * cancels the previous one. "silent" loads keep showing the current list.
 */
type LoadRequest = { id: number; silent: boolean };

const SMALL_BUTTON =
  "rounded-md border border-gray-400/60 px-3 py-1.5 text-sm font-medium hover:bg-gray-400/10";

function SkeletonCards() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading projects…</span>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((n) => (
          <div
            key={n}
            className="animate-pulse space-y-4 rounded-xl border border-gray-400/30 bg-gray-500/5 p-5"
          >
            <div className="h-5 w-2/3 rounded bg-gray-500/20" />
            <div className="space-y-2">
              <div className="h-3 w-full rounded bg-gray-500/15" />
              <div className="h-3 w-5/6 rounded bg-gray-500/15" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="h-8 rounded bg-gray-500/15" />
              <div className="h-8 rounded bg-gray-500/15" />
            </div>
            <div className="h-8 rounded bg-gray-500/15" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-400/50 px-6 py-14 text-center">
      <h3 className="text-lg font-semibold">No projects yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
        Create your first project to start collecting knowledge and preparing a
        reliable handover.
      </p>
      <button type="button" onClick={onCreate} className={`${PRIMARY_BUTTON} mt-6`}>
        Create Project
      </button>
    </div>
  );
}

export default function ProjectDashboard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [request, setRequest] = useState<LoadRequest>({ id: 0, silent: false });
  const [formOpen, setFormOpen] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshFailed, setRefreshFailed] = useState(false);

  const createButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  // The one place the list is loaded: first load, Retry, and the silent
  // refresh after a project is created. The cleanup cancels an older request
  // when a newer one starts (or when the page is left), and results from a
  // cancelled request are ignored.
  useEffect(() => {
    const controller = new AbortController();
    const { silent } = request;

    listProjects(controller.signal)
      .then((projects) => {
        if (controller.signal.aborted) return;
        setState({ kind: "ready", projects });
        setRefreshFailed(false);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (silent) {
          // Keep showing the list we have; just tell the user it may be stale.
          setRefreshFailed(true);
          return;
        }
        setState({
          kind: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Unexpected error while loading projects.",
        });
      });

    return () => controller.abort();
  }, [request]);

  // After the form closes (cancel or success), put focus back on the Create button.
  useEffect(() => {
    if (!formOpen && restoreFocusRef.current) {
      restoreFocusRef.current = false;
      createButtonRef.current?.focus();
    }
  }, [formOpen]);

  function retry() {
    setState({ kind: "loading" });
    setRequest((previous) => ({ id: previous.id + 1, silent: false }));
  }

  function refresh() {
    setRequest((previous) => ({ id: previous.id + 1, silent: true }));
  }

  function openForm() {
    setSuccess(null);
    setFormOpen(true);
  }

  function closeForm() {
    restoreFocusRef.current = true;
    setFormOpen(false);
  }

  function handleCreated(project: Project) {
    // Show the server's own response at once, then reconcile with the database.
    setState((previous) =>
      previous.kind === "ready"
        ? {
            kind: "ready",
            projects: [
              project,
              ...previous.projects.filter((existing) => existing.id !== project.id),
            ],
          }
        : previous
    );
    setSuccess(`Project “${project.name}” was created.`);
    setRefreshFailed(false);
    closeForm();
    refresh();
  }

  const isReady = state.kind === "ready";

  return (
    <section aria-labelledby="projects-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="projects-heading" className="text-xl font-semibold tracking-tight">
            Projects
          </h2>
          {state.kind === "ready" && (
            <p className="mt-0.5 text-sm text-gray-500">
              {state.projects.length === 1
                ? "1 project"
                : `${state.projects.length} projects`}
            </p>
          )}
        </div>
        <button
          ref={createButtonRef}
          type="button"
          onClick={openForm}
          disabled={!isReady || formOpen}
          aria-expanded={formOpen}
          className={PRIMARY_BUTTON}
        >
          Create Project
        </button>
      </div>

      {/* Always present, so screen readers reliably announce the message. */}
      <p role="status" className="sr-only">
        {success ?? ""}
      </p>

      {success && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
            {success}
          </p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className={`${SMALL_BUTTON} shrink-0`}
          >
            Dismiss
          </button>
        </div>
      )}

      {refreshFailed && isReady && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4"
        >
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            The project was created, but the list couldn’t be refreshed. What you
            see below may be out of date.
          </p>
          <button
            type="button"
            onClick={() => {
              setRefreshFailed(false);
              refresh();
            }}
            className={`${SMALL_BUTTON} shrink-0`}
          >
            Retry
          </button>
        </div>
      )}

      {formOpen && isReady && (
        <ProjectForm onCreated={handleCreated} onCancel={closeForm} />
      )}

      {state.kind === "loading" && <SkeletonCards />}

      {state.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-5"
        >
          <p className="font-medium text-red-700 dark:text-red-400">
            {state.message}
          </p>
          <button type="button" onClick={retry} className={`${SMALL_BUTTON} mt-3`}>
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" &&
        (state.projects.length === 0 ? (
          !formOpen && <EmptyState onCreate={openForm} />
        ) : (
          <ProjectList projects={state.projects} />
        ))}
    </section>
  );
}