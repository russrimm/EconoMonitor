'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { prepareDatasetsForAnalysis, type AnalyzeDataset } from '@/lib/ai';
import {
  readBoundedResponseChunks,
  readBoundedResponseText,
  withDeadline,
} from '@/lib/responseBody';

const MAX_RESPONSE_BYTES = 128 * 1024;

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
  useEffect(() => () => abortRef.current?.abort(), []);

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
        body: JSON.stringify({ datasets: prepareDatasetsForAnalysis(datasets) }),
        signal: withDeadline(controller.signal, 75_000),
      });

      if (!res.ok) {
        const msg = await readBoundedResponseText(res, 4 * 1024);
        if (abortRef.current !== controller) return;
        setError(msg || `Request failed (${res.status})`);
        return;
      }

      const decoder = new TextDecoder();

      for await (const value of readBoundedResponseChunks(res, MAX_RESPONSE_BYTES)) {
        const chunk = decoder.decode(value, { stream: true });
        if (abortRef.current === controller) {
          setText((prev) => prev + chunk);
        }
      }
      const finalChunk = decoder.decode();
      if (finalChunk && abortRef.current === controller) {
        setText((prev) => prev + finalChunk);
      }
    } catch (err) {
      if ((err as { name?: string }).name !== 'AbortError') {
        if (abortRef.current === controller) {
          setError((err as Error).message ?? 'Unknown error');
        }
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsStreaming(false);
      }
    }
  }, []);

  return { analyze, text, isStreaming, error, reset };
}
