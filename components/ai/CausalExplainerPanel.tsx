'use client';

import { useEffect, useMemo, useState } from 'react';
import { BookOpen, HelpCircle, Loader2, Sparkles } from 'lucide-react';
import { useAiExplain, type ExplainCandidate } from '@/hooks/useAiExplain';
import { topMovers } from '@/lib/anomaly';
import { CATEGORY_COLOR } from '@/lib/events';
import type { FredObservation } from '@/lib/fred';
import { formatDate } from '@/lib/utils';

interface Props {
  seriesId: string;
  label: string;
  units: string;
  observations: FredObservation[];
}

const MAX_OBS_PER_REQUEST = 24;

/** Pull a window of observations centered on `focusDate`, downsampled to fit. */
function windowAroundDate(
  observations: FredObservation[],
  focusDate: string,
  maxPoints = MAX_OBS_PER_REQUEST,
): { date: string; value: string }[] {
  const valid = observations.filter((o) => o.value !== '.' && o.value !== '');
  if (valid.length === 0) return [];

  // Find the index closest to focusDate.
  let idx = 0;
  for (let i = 0; i < valid.length; i++) {
    if (valid[i].date <= focusDate) idx = i;
    else break;
  }

  const half = Math.floor(maxPoints / 2);
  let start = Math.max(0, idx - half);
  let end = Math.min(valid.length, start + maxPoints);
  start = Math.max(0, end - maxPoints);

  const window = valid.slice(start, end);

  // If the window is still larger than maxPoints, evenly downsample.
  if (window.length <= maxPoints) {
    return window.map((o) => ({ date: o.date, value: o.value }));
  }
  const result: { date: string; value: string }[] = [];
  const stride = (window.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) {
    const o = window[Math.round(i * stride)];
    result.push({ date: o.date, value: o.value });
  }
  return result;
}

/** Render prose with **[event-id]** citations linked to FRASER. */
function renderProseWithCitations(
  text: string,
  candidates: ExplainCandidate[],
): React.ReactNode[] {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  // Split on either **[id]** or [id] markers.
  const re = /\*?\*?\[([a-z0-9-]+)\]\*?\*?/gi;
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    const id = m[1];
    const cand = byId.get(id);
    if (m.index > last) out.push(<span key={key++}>{text.slice(last, m.index)}</span>);
    if (cand) {
      out.push(
        <a
          key={key++}
          href={cand.fraserUrl}
          target="_blank"
          rel="noopener noreferrer"
          title={`${cand.title} (${cand.date})`}
          className="font-semibold underline decoration-dotted underline-offset-2"
          style={{ color: CATEGORY_COLOR[cand.category] }}
        >
          {cand.title}
        </a>,
      );
    } else {
      out.push(<span key={key++}>{m[0]}</span>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(<span key={key++}>{text.slice(last)}</span>);
  return out;
}

export function CausalExplainerPanel({ seriesId, label, units, observations }: Props) {
  const { explain, text, candidates, isStreaming, error, reset } = useAiExplain();
  const [isOpen, setIsOpen] = useState(false);
  const [focusDate, setFocusDate] = useState<string>('');

  // Default the focus date to the single biggest absolute move on first hydration.
  const movers = useMemo(() => topMovers(observations, 5), [observations]);
  useEffect(() => {
    if (!focusDate && movers.length > 0) {
      setFocusDate(movers[0].date);
    }
  }, [focusDate, movers]);

  const valid = observations.filter((o) => o.value !== '.' && o.value !== '');
  const earliest = valid[0]?.date ?? '';
  const latest = valid[valid.length - 1]?.date ?? '';

  const hasResult = text.length > 0 || isStreaming || error !== null;

  function handleRun() {
    if (!isOpen) setIsOpen(true);
    if (!focusDate) return;
    explain({
      seriesId,
      label,
      units,
      focusDate,
      observations: windowAroundDate(observations, focusDate),
    });
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
          <HelpCircle className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Why did this move?
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRun();
          }}
          disabled={isStreaming || !focusDate}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: 'var(--accent)', color: '#fff' }}
        >
          {isStreaming ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Explaining…
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              {hasResult ? 'Re-explain' : 'Explain'}
            </>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="px-4 py-4 flex flex-col gap-4">
          {/* Date picker + quick movers */}
          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label
                className="block text-xs font-medium mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                Focus date
              </label>
              <input
                type="date"
                value={focusDate}
                min={earliest}
                max={latest}
                onChange={(e) => setFocusDate(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
            {movers.length > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Biggest moves
                </span>
                <div className="flex flex-wrap gap-1">
                  {movers.map((m) => {
                    const active = m.date === focusDate;
                    return (
                      <button
                        key={m.date}
                        onClick={() => setFocusDate(m.date)}
                        className="px-2 py-1 rounded-md text-xs font-mono transition-colors"
                        style={{
                          background: active
                            ? 'color-mix(in srgb, var(--accent) 14%, transparent)'
                            : 'var(--surface-2)',
                          color: active ? 'var(--accent)' : 'var(--text-muted)',
                          border: `1px solid ${active ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
                        }}
                      >
                        {formatDate(m.date)} ({m.change >= 0 ? '+' : ''}
                        {m.change.toLocaleString('en-US', { maximumFractionDigits: 2 })})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'color-mix(in srgb, #ef4444 10%, transparent)',
                border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                color: '#ef4444',
              }}
            >
              {error}
            </div>
          )}

          {/* Streamed explanation */}
          {(text || isStreaming) && (
            <div
              className="rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                background: 'var(--surface-2)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {renderProseWithCitations(text, candidates)}
              {isStreaming && (
                <span
                  className="inline-block ml-1 w-1.5 h-3 align-middle animate-pulse"
                  style={{ background: 'var(--accent)' }}
                />
              )}
            </div>
          )}

          {/* Cited / candidate events */}
          {candidates.length > 0 && (
            <div>
              <h3
                className="text-xs font-medium uppercase tracking-wide mb-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Candidate events near this date
              </h3>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {candidates.map((c) => {
                  const color = CATEGORY_COLOR[c.category];
                  const cited = text.toLowerCase().includes(`[${c.id}]`);
                  return (
                    <li key={c.id}>
                      <a
                        href={c.fraserUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-2 p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{
                          border: `1px solid ${cited ? color + '88' : 'var(--border)'}`,
                          background: cited ? color + '0d' : 'transparent',
                        }}
                      >
                        <span
                          className="mt-1 w-2 h-2 rounded-full shrink-0"
                          style={{ background: color }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-medium text-sm truncate"
                              style={{ color: 'var(--text)' }}
                            >
                              {c.title}
                            </span>
                            {cited && (
                              <span
                                className="text-[10px] uppercase tracking-wide font-semibold px-1.5 py-0.5 rounded"
                                style={{
                                  color,
                                  background: `color-mix(in srgb, ${color} 14%, transparent)`,
                                }}
                              >
                                cited
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs mt-0.5"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {c.endDate ? `${formatDate(c.date)} – ${formatDate(c.endDate)}` : formatDate(c.date)} ·{' '}
                            <span className="inline-flex items-center gap-1">
                              <BookOpen className="w-3 h-3" />
                              FRASER
                            </span>
                          </p>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Reset link */}
          {hasResult && !isStreaming && (
            <button
              onClick={reset}
              className="text-xs underline self-start"
              style={{ color: 'var(--text-muted)' }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
