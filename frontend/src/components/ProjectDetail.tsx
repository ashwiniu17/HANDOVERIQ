
"use client";

import HandoverWorkspace from "./HandoverWorkspace";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ApiError } from "../lib/api";
import { formatDateTime } from "../lib/dates";
import { deleteProject, getProject, type Project } from "../lib/projects";
import {
  DANGER_BUTTON,
  DANGER_OUTLINE_BUTTON,
  SECONDARY_BUTTON,
} from "./buttonStyles";
import StatusBadge from "./StatusBadge";

// Largest id a 32-bit database INTEGER can hold.
const MAX_PROJECT_ID = 2_147_483_647;

/** Turns the address segment into a valid project id, or null if invalid. */
function parseProjectId(raw: string): number | null {
  if (!/^[0-9]+$/.test(raw)) return null;

  const value = Number(raw);

  if (
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_PROJECT_ID
  ) {
    return null;
  }

  return value;
}

type LoadState =
  | { kind: "loading" }
  | { kind: "not_found" }
  | { kind: "error"; message: string }
  | { kind: "ready"; project: Project };

function DetailSkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Loading project…</span>

      <div
        aria-hidden="true"
        className="animate-pulse space-y-8 rounded-xl border border-gray-400/30 bg-gray-500/5 p-5 sm:p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="h-8 w-2/3 rounded bg-gray-500/20" />
          <div className="h-6 w-16 rounded-full bg-gray-500/15" />
        </div>

        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-gray-500/15" />
          <div className="h-3 w-5/6 rounded bg-gray-500/15" />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-10 rounded bg-gray-500/15" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium">{children}</dd>
    </div>
  );
}

export default function ProjectDetail({ rawId }: { rawId: string }) {
  const projectId = parseProjectId(rawId);
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Refs prevent duplicate deletion requests before React re-renders.
  const deletingRef = useRef(false);
  const mountedRef = useRef(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Load project details. Invalid IDs never reach the backend.
  useEffect(() => {
    if (projectId === null) return;

    const controller = new AbortController();

    getProject(projectId, controller.signal)
      .then((project) => {
        if (!controller.signal.aborted) {
          setState({ kind: "ready", project });
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;

        if (err instanceof ApiError && err.code === "project_not_found") {
          setState({ kind: "not_found" });
          return;
        }

        setState({
          kind: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Unexpected error while loading the project.",
        });
      });

    return () => controller.abort();
  }, [projectId, attempt]);

  // Manage keyboard focus when the delete confirmation opens and closes.
  useEffect(() => {
    if (confirming) {
      cancelButtonRef.current?.focus();
    } else if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [confirming]);

  const view: LoadState =
    projectId === null ? { kind: "not_found" } : state;

  function retry() {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  function openConfirm() {
    setDeleteError(null);
    setConfirming(true);
  }

  function cancelDelete() {
    restoreFocusRef.current = true;
    setDeleteError(null);
    setConfirming(false);
  }

  async function handleDelete(id: number) {
    if (deletingRef.current) return;

    deletingRef.current = true;
    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteProject(id);

      // Keep the deletion lock active while navigating away.
      if (mountedRef.current) {
        router.replace("/");
      }
    } catch (err: unknown) {
      deletingRef.current = false;

      if (!mountedRef.current) return;

      setDeleting(false);

      if (err instanceof ApiError && err.code === "project_not_found") {
        setConfirming(false);
        setState({ kind: "not_found" });
        return;
      }

      setDeleteError(
        err instanceof ApiError
          ? err.message
          : "Something went wrong while deleting the project. Please try again."
      );
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-indigo-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 dark:text-indigo-400"
      >
        <span aria-hidden="true">←</span>
        Back to dashboard
      </Link>

      {view.kind === "loading" && <DetailSkeleton />}

      {view.kind === "not_found" && (
        <div className="rounded-xl border border-dashed border-gray-400/50 px-6 py-14 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            Project not found
          </h1>

          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
            There is no project at this address. It may have been deleted, or
            the link may be incorrect.
          </p>
        </div>
      )}

      {view.kind === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-5"
        >
          <p className="font-medium text-red-700 dark:text-red-400">
            {view.message}
          </p>

          <button
            type="button"
            onClick={retry}
            className={`${SECONDARY_BUTTON} mt-3`}
          >
            Retry
          </button>
        </div>
      )}

      {view.kind === "ready" && (
        <>
          <article className="space-y-8 rounded-xl border border-gray-400/40 bg-gray-500/5 p-5 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Project
                </p>

                <h1 className="mt-1 break-words text-2xl font-bold tracking-tight sm:text-3xl">
                  {view.project.name}
                </h1>
              </div>

              <StatusBadge status={view.project.status} />
            </div>

            <section aria-labelledby="description-heading">
              <h2
                id="description-heading"
                className="text-xs font-medium uppercase tracking-wide text-gray-500"
              >
                Description
              </h2>

              {view.project.description ? (
                <p className="mt-2 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
                  {view.project.description}
                </p>
              ) : (
                <p className="mt-2 italic text-gray-500">
                  No description was provided for this project.
                </p>
              )}
            </section>

            <dl className="grid gap-6 sm:grid-cols-2">
              <DetailItem label="Outgoing member">
                {view.project.outgoing_member}
              </DetailItem>

              <DetailItem label="Incoming member">
                {view.project.incoming_member}
              </DetailItem>

              <DetailItem label="Created">
                <time dateTime={view.project.created_at}>
                  {formatDateTime(view.project.created_at)}
                </time>
              </DetailItem>

              <DetailItem label="Last updated">
                <time dateTime={view.project.updated_at}>
                  {formatDateTime(view.project.updated_at)}
                </time>
              </DetailItem>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-400/30 pt-6">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className={SECONDARY_BUTTON}
                >
                  Edit project
                </button>

                <span className="text-xs text-gray-500">
                  Coming soon
                </span>
              </div>

              {!confirming && (
                <button
                  ref={deleteButtonRef}
                  type="button"
                  onClick={openConfirm}
                  className={DANGER_OUTLINE_BUTTON}
                >
                  Delete project
                </button>
              )}
            </div>
          </article>

          {/* Main document and handover workflow for this project. */}
          <HandoverWorkspace projectId={view.project.id} />

          {confirming && (
            <div
              role="group"
              aria-labelledby="delete-heading"
              aria-describedby="delete-description"
              aria-busy={deleting}
              onKeyDown={(event) => {
                if (event.key === "Escape" && !deleting) {
                  cancelDelete();
                }
              }}
              className="space-y-4 rounded-xl border border-red-500/40 bg-red-500/10 p-5"
            >
              <div>
                <h2
                  id="delete-heading"
                  className="text-base font-semibold text-red-800 dark:text-red-300"
                >
                  Delete this project?
                </h2>

                <p
                  id="delete-description"
                  className="mt-1 break-words text-sm text-red-800 dark:text-red-300"
                >
                  “{view.project.name}” will be permanently deleted. This
                  can’t be undone.
                </p>
              </div>

              {deleteError && (
                <p
                  role="alert"
                  className="rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm font-medium text-red-700 dark:text-red-400"
                >
                  {deleteError}
                </p>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleDelete(view.project.id)}
                  disabled={deleting}
                  className={DANGER_BUTTON}
                >
                  {deleting ? "Deleting…" : "Yes, delete project"}
                </button>

                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={cancelDelete}
                  disabled={deleting}
                  className={SECONDARY_BUTTON}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
