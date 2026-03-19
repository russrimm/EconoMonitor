'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Theme ─────────────────────────────────────────────────────────────────────

interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Providers ─────────────────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('econoMonitor:theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored !== null ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', isDark);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(isDark);
  }, []);

  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      localStorage.setItem('econoMonitor:theme', next ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ dark, toggle }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ThemeContext.Provider>
  );
}
