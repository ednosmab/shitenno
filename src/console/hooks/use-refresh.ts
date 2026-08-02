/**
 * use-refresh.ts — Auto-refresh hook
 *
 * Periodically re-collects data for live dashboard updates.
 */

import { useState, useEffect, useCallback } from "react";
import { getOrCollectConsoleData, clearConsoleDataCache, type ConsoleData } from "../data-collector.js";

export function useRefresh(
  projectRoot: string,
  shitennoDir: string,
  intervalMs: number = 0
) {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Initial load
  useEffect(() => {
    let cancelled = false;
    getOrCollectConsoleData(projectRoot, shitennoDir).then((d) => {
      if (!cancelled) setData(d);
    });
    return () => { cancelled = true; };
  }, [projectRoot, shitennoDir]);

  const refresh = useCallback(() => {
    clearConsoleDataCache(); // Force fresh data on manual refresh
    getOrCollectConsoleData(projectRoot, shitennoDir).then((newData) => {
      setData(newData);
      setLastRefresh(new Date());
    });
  }, [projectRoot, shitennoDir]);

  useEffect(() => {
    if (intervalMs <= 0) return;

    const timer = setInterval(refresh, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, refresh]);

  return { data, refresh, lastRefresh };
}
