import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 2500; // NFR-6

interface PollState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** Resolves once this fetch's result has actually landed in `data` —
   * callers that need to know the refreshed data is visible (not just
   * requested) can `await` it, e.g. before showing a "done" status. */
  refetch: () => Promise<void>;
}

/**
 * Fetches `fetcher()` immediately and then every POLL_INTERVAL_MS, so
 * document processing status and the event list reflect background
 * changes without a manual page reload (NFR-6).
 */
export function usePoll<T>(fetcher: () => Promise<T>, deps: unknown[]): PollState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  // A ref (not the closure returned from a single load() call) so the
  // *current* in-flight fetch is always the one checked, regardless of
  // which call started it — matters now that load() is awaited directly
  // by callers rather than only invoked from the effect/interval below.
  const cancelledRef = useRef(false);

  const load = useCallback((): Promise<void> => {
    return fetcherRef
      .current()
      .then((result) => {
        if (!cancelledRef.current) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelledRef.current) setError(err);
      })
      .finally(() => {
        if (!cancelledRef.current) setLoading(false);
      });
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    setLoading(true);
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelledRef.current = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch: load };
}
