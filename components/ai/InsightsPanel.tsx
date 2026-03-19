'use client';

import { useState } from 'react';
import { Loader2, RotateCcw, Sparkles } from 'lucide-react';
import { useAiAnalysis } from '@/hooks/useAiAnalysis';
import type { AnalyzeDataset } from '@/lib/ai';

interface Props {
  datasets: AnalyzeDataset[];
  title?: string;
}

// ---------------------------------------------------------------------------
// Inline mini-markdown renderer
// Handles: ### headings, **bold**, - / * bullet lists, paragraph breaks
// No external deps required.
// ---------------------------------------------------------------------------
function renderMarkdown(raw: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const paragraphs = raw.split(/\n{2,}/);

  paragraphs.forEach((para, pi) => {
    const lines = para.split('\n');
    let listItems: string[] | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ### Heading
      if (line.startsWith('### ')) {
        if (listItems) {
          nodes.push(renderList(listItems, `${pi}-list-${i}`));
          listItems = null;
        }
        nodes.push(
          <h3
            key={`${pi}-h-${i}`}
            className="text-sm font-semibold mt-5 mb-1.5"
            style={{ color: 'var(--text)' }}
          >
            {inlineBold(line.slice(4))}
          </h3>,
        );
        continue;
      }

      // ## Heading (level 2, fallback)
      if (line.startsWith('## ')) {
        if (listItems) {
          nodes.push(renderList(listItems, `${pi}-list-${i}`));
          listItems = null;
        }
        nodes.push(
          <h2
            key={`${pi}-h2-${i}`}
            className="text-sm font-semibold mt-5 mb-1.5"
            style={{ color: 'var(--text)' }}
          >
            {inlineBold(line.slice(3))}
          </h2>,
        );
        continue;
      }

      // Bullet list item
      if (/^[\-\*]\s/.test(line)) {
        if (!listItems) listItems = [];
        listItems.push(line.slice(2));
        continue;
      }

      // Flush list if we hit a non-list line
      if (listItems) {
        nodes.push(renderList(listItems, `${pi}-list-${i}`));
        listItems = null;
      }

      // Regular line — skip empty
      if (line.trim() === '') continue;

      nodes.push(
        <p
          key={`${pi}-p-${i}`}
          className="text-sm leading-relaxed"
          style={{ color: 'var(--text-muted)' }}
        >
          {inlineBold(line)}
        </p>,
      );
    }

    // Flush any trailing list
    if (listItems) {
      nodes.push(renderList(listItems, `${pi}-list-end`));
    }
  });

  return nodes;
}

function renderList(items: string[], key: string): React.ReactNode {
  return (
    <ul key={key} className="list-disc list-inside text-sm space-y-0.5 my-1.5">
      {items.map((item, i) => (
        <li key={i} style={{ color: 'var(--text-muted)' }}>
          {inlineBold(item)}
        </li>
      ))}
    </ul>
  );
}

function inlineBold(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={i} style={{ color: 'var(--text)' }}>
        {part.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

// ---------------------------------------------------------------------------
// InsightsPanel
// ---------------------------------------------------------------------------
export function InsightsPanel({ datasets, title = 'AI Insights' }: Props) {
  const { analyze, text, isStreaming, error, reset } = useAiAnalysis();
  const [isOpen, setIsOpen] = useState(false);
  const hasResult = text.length > 0 || isStreaming || error !== null;

  function handleAnalyze() {
    if (!isOpen) setIsOpen(true);
    analyze(datasets);
  }

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      {/* Header row */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none"
        style={{ borderBottom: isOpen ? '1px solid var(--border)' : 'none' }}
        onClick={() => setIsOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {title}
          </span>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              color: 'var(--accent)',
            }}
          >
            gpt-4o
          </span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {hasResult && !isStreaming && (
            <button
              onClick={reset}
              title="Reset"
              className="p-1 rounded transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={handleAnalyze}
            disabled={isStreaming || datasets.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{
              background: 'var(--accent)',
              color: '#fff',
            }}
          >
            {isStreaming ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                {hasResult ? 'Re-analyze' : 'Analyze'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div className="px-4 py-4">
          {/* Error banner */}
          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm mb-4"
              style={{
                background: 'color-mix(in srgb, var(--red) 10%, transparent)',
                border: '1px solid color-mix(in srgb, var(--red) 30%, transparent)',
                color: 'var(--red)',
              }}
            >
              <strong>Error: </strong>
              {error}
            </div>
          )}

          {/* Streamed content */}
          {text.length > 0 && (
            <div>
              {renderMarkdown(text)}
              {isStreaming && (
                <span
                  className="inline-block w-0.5 h-4 ml-0.5 animate-pulse"
                  style={{ background: 'var(--accent)', verticalAlign: 'text-bottom' }}
                />
              )}
            </div>
          )}

          {/* Empty state — before first analysis */}
          {!hasResult && (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Click <strong style={{ color: 'var(--text)' }}>Analyze</strong> to generate
              AI-powered economic insights for the{' '}
              {datasets.length === 1
                ? 'selected series'
                : `${datasets.length} selected series`}
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
