import { useCallback, useEffect, useRef, useState } from "react";

const POLL_INTERVAL_MS = 2500; // NFR-6

interface PollState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  refetch: () => void;
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

  const load = useCallback(() => {
    let cancelled = false;
    fetcherRef.current()
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setLoading(true);
    const cancel = load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancel();
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch: load };
}
