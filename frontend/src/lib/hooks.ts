"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type State<T> = { data: T | undefined; error: Error | undefined; loading: boolean };

/**
 * Loads data when `key` changes and exposes `reload()`.
 *
 * While reloading, the previous data stays visible (no flicker). The loader is
 * read from a ref, so callers do not have to memoise it; `key` says when to
 * load again (for example the project id).
 */
export function useResource<T>(loader: () => Promise<T>, key: string | number = "") {
  const [state, setState] = useState<State<T>>({ data: undefined, error: undefined, loading: true });
  const [version, setVersion] = useState(0);
  const loaderRef = useRef(loader);

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    let cancelled = false;
    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ data, error: undefined, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState((previous) => ({
            data: previous.data,
            error: error instanceof Error ? error : new Error("Something went wrong."),
            loading: false,
          }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const setData = useCallback(
    (data: T) => setState({ data, error: undefined, loading: false }),
    []
  );

  return { ...state, reload, setData };
}
