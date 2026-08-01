'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventCategory } from '@/lib/events';

export interface ExplainCandidate {
  id: string;
  title: string;
  date: string;
  endDate: string | null;
  category: EventCategory;
  summary: string;
  fraserUrl: string;
}

export interface ExplainRequest {
  seriesId: string;
  label: string;
  units: string;
  focusDate: string;
  observations: { date: string; value: string }[];
}

export interface UseAiExplainResult {
  explain: (req: ExplainRequest) => Promise<void>;
  text: string;
  candidates: ExplainCandidate[];
  isStreaming: boolean;
  error: string | null;
  reset: () => void;
}

export function useAiExplain(): UseAiExplainResult {
  const [text, setText] = useState('');
  const [candidates, setCandidates] = useState<ExplainCandidate[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setText('');
    setCandidates([]);
    setIsStreaming(false);
    setError(null);
  }, []);

  const explain = useCallback(async (req: ExplainRequest) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setText('');
    setCandidates([]);
    setError(null);
    setIsStreaming(true);

    try {
      const res = await fetch('/api/ai/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
        signal: controller.signal,
      });

      if (!res.ok) {
        const msg = await res.text();
        if (abortRef.current !== controller) return;
        setError(msg || `Request failed (${res.status})`);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let metaConsumed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        if (!metaConsumed) {
          const nl = buffer.indexOf('\n');
          if (nl >= 0) {
            const headerLine = buffer.slice(0, nl);
            buffer = buffer.slice(nl + 1);
            try {
              const parsed = JSON.parse(headerLine) as {
                __meta?: string;
                candidates?: ExplainCandidate[];
              };
              if (parsed.__meta === 'candidates' && parsed.candidates) {
                if (abortRef.current === controller) {
                  setCandidates(parsed.candidates);
                }
              }
            } catch {
              // No metadata header — treat the whole line as prose.
              buffer = headerLine + '\n' + buffer;
            }
            metaConsumed = true;
          } else {
            // Header not yet complete — wait for more data.
            continue;
          }
        }

        if (buffer.length > 0) {
          if (abortRef.current === controller) {
            setText((prev) => prev + buffer);
          }
          buffer = '';
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

  return { explain, text, candidates, isStreaming, error, reset };
}
