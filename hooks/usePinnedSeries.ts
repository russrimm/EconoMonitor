'use client';

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'econoMonitor:pinned';

const DEFAULT_PINNED = ['GDP', 'UNRATE', 'CPIAUCSL', 'DFF', 'T10Y2Y', 'DCOILWTICO'];

export function usePinnedSeries() {
  const [pinned, setPinned] = useState<string[]>(DEFAULT_PINNED);
  const [hydrated, setHydrated] = useState(false);

  // Read from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPinned(parsed);
        }
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((ids: string[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  }, []);

  const pin = useCallback(
    (id: string) => {
      setPinned((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const unpin = useCallback(
    (id: string) => {
      setPinned((prev) => {
        const next = prev.filter((x) => x !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const toggle = useCallback(
    (id: string) => {
      setPinned((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isPinned = useCallback((id: string) => pinned.includes(id), [pinned]);

  return { pinned, pin, unpin, toggle, isPinned, hydrated };
}
