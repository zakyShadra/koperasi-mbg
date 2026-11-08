import { useCallback, useEffect, useRef, useState } from 'react';

export function usePolling(
  refresh: () => Promise<string | void>,
  options?: { intervalMs?: number; paused?: boolean; resetKey?: string },
): { justUpdated: boolean } {
  const [justUpdated, setJustUpdated] = useState(false);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const pausedRef = useRef(options?.paused ?? false);
  pausedRef.current = options?.paused ?? false;
  const lastPrint = useRef<string | null>(null);
  const hideTimer = useRef<number | null>(null);
  const startedRef = useRef(false);

  const run = useCallback(async () => {
    if (pausedRef.current || document.hidden) return;
    let print: string | void;
    try {
      print = await refreshRef.current();
    } catch {
      return;
    }
    if (!print) return;
    if (lastPrint.current !== null && print !== lastPrint.current) {
      setJustUpdated(true);
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => setJustUpdated(false), 4000);
    }
    lastPrint.current = print;
  }, []);

  const intervalMs = options?.intervalMs ?? 15000;

  useEffect(() => {
    const id = window.setInterval(() => void run(), intervalMs);
    const onVisible = () => {
      if (!document.hidden) void run();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [run, intervalMs]);

  const paused = options?.paused ?? false;
  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      return;
    }
    if (!paused) void run();
  }, [paused, run]);

  const resetKey = options?.resetKey;
  useEffect(() => {
    lastPrint.current = null;
  }, [resetKey]);

  useEffect(
    () => () => {
      if (hideTimer.current !== null) window.clearTimeout(hideTimer.current);
    },
    [],
  );

  return { justUpdated };
}
