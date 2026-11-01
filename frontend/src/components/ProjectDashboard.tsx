"use client";

import { useEffect, useState } from "react";
import { ApiError } from "../lib/api";
import { listProjects, type Project } from "../lib/projects";
import ProjectList from "./ProjectList";

type LoadState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; projects: Project[] };

const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

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

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-gray-400/50 px-6 py-14 text-center">
      <h3 className="text-lg font-semibold">No projects yet</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
        Create your first project to start collecting knowledge and preparing a
        reliable handover.
      </p>
      <button
        type="button"
        disabled
        title="The create form arrives in the next step"
        className={`${PRIMARY_BUTTON} mt-6`}
      >
        Create Project
      </button>
    </div>
  );
}

export default function ProjectDashboard() {
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    listProjects(controller.signal)
      .then((projects) => {
        if (!controller.signal.aborted) setState({ kind: "ready", projects });
      })
      .catch((err: unknown) => {
        // A request cancelled on purpose (leaving the page, or a retry) is not an error.
        if (controller.signal.aborted) return;
        setState({
          kind: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Unexpected error while loading projects.",
        });
      });

    return () => controller.abort();
  }, [attempt]);

  function retry() {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

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
          type="button"
          disabled
          title="The create form arrives in the next step"
          className={PRIMARY_BUTTON}
        >
          Create Project
        </button>
      </div>

      {state.kind === "loading" && <SkeletonCards />}

      {state.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-5"
        >
          <p className="font-medium text-red-700 dark:text-red-400">
            {state.message}
          </p>
          <button
            type="button"
            onClick={retry}
            className="mt-3 rounded-md border border-gray-400/60 px-3 py-1.5 text-sm font-medium hover:bg-gray-400/10"
          >
            Retry
          </button>
        </div>
      )}

      {state.kind === "ready" &&
        (state.projects.length === 0 ? (
          <EmptyState />
        ) : (
          <ProjectList projects={state.projects} />
        ))}
    </section>
  );
}