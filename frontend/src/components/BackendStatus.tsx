"use client";

import { useEffect, useState } from "react";
import { ApiError, getHealth, type HealthResponse } from "../lib/api";

type State =
  | { kind: "loading" }
  | { kind: "ok"; health: HealthResponse }
  | { kind: "error"; message: string };

export default function BackendStatus() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;

    getHealth()
      .then((health) => {
        if (!cancelled) setState({ kind: "ok", health });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Unexpected error while contacting the server.";
        setState({ kind: "error", message });
      });

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function retry() {
    setState({ kind: "loading" });
    setAttempt((n) => n + 1);
  }

  return (
    <section className="rounded-lg border border-gray-400/40 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        Backend connection
      </h2>

      {state.kind === "loading" && <p className="mt-3">Checking backend…</p>}

      {state.kind === "ok" && (
        <div className="mt-3 space-y-1">
          <p className="font-medium text-green-600">
            Connected: {state.health.service}
          </p>
          <p className="text-sm text-gray-500">
            Claude API key configured on server:{" "}
            {state.health.anthropic_configured ? "yes" : "no"}
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="mt-3 space-y-3">
          <p className="font-medium text-red-600">{state.message}</p>
          <button
            onClick={retry}
            className="rounded-md border border-gray-400/60 px-3 py-1.5 text-sm hover:bg-gray-400/10"
          >
            Retry
          </button>
        </div>
      )}
    </section>
  );
}