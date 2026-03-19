'use client';

import { useCallback, useRef, useState } from 'react';
import type { AnalyzeDataset } from '@/lib/ai';

export interface UseAiAnalysisResult {
  analyze: (datasets: AnalyzeDataset[]) => Promise<void>;
  text: string;
  isStreaming: boolean;
  error: string | null;
  reset: () => void;
}

export function useAiAnalysis(): UseAiAnalysisResult {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText('');
    setIsStreaming(false);
    setError(null);
  }, []);

  const analyze = useCallback(async (datasets: AnalyzeDataset[]) => {
    // Cancel any in-flight request before starting a new one
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
    setError(null);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasets }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        setError(msg || `Request failed (${res.status})`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setText((prev) => prev + chunk);
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        setError((err as Error).message ?? 'Unknown error');
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  return { analyze, text, isStreaming, error, reset };
}
