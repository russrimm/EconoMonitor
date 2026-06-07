'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  CUSTOM_INDICATORS_STORAGE_KEY,
  type CustomIndicator,
} from '@/lib/customIndicator';

export function useCustomIndicators() {
  const [indicators, setIndicators] = useState<CustomIndicator[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_INDICATORS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setIndicators(parsed as CustomIndicator[]);
        }
      }
    } catch {
      // ignore malformed storage
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: CustomIndicator[]) => {
    localStorage.setItem(CUSTOM_INDICATORS_STORAGE_KEY, JSON.stringify(next));
  }, []);

  const save = useCallback(
    (indicator: CustomIndicator) => {
      setIndicators((prev) => {
        const idx = prev.findIndex((x) => x.id === indicator.id);
        const next = idx >= 0
          ? prev.map((x, i) => (i === idx ? indicator : x))
          : [...prev, indicator];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      setIndicators((prev) => {
        const next = prev.filter((x) => x.id !== id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const get = useCallback(
    (id: string) => indicators.find((x) => x.id === id),
    [indicators],
  );

  return { indicators, save, remove, get, hydrated };
}
