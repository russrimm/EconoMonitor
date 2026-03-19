'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Loader2, Pin, Search, Sparkles, X } from 'lucide-react';
import { useMultiObservations, useMultiSeries, useSeriesSearch } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { InsightsPanel } from '@/components/ai/InsightsPanel';
import { CHART_COLORS } from '@/lib/utils';
import type { ObservationRange } from '@/lib/fred';
import type { AnalyzeDataset } from '@/lib/ai';

const MAX_SERIES = 6;

const RANGES: { label: string; value: ObservationRange }[] = [
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
  { label: 'Max', value: 'max' },
];

export default function InsightsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedIds = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SERIES);

  const range = (searchParams.get('range') ?? '5y') as ObservationRange;

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { pinned: pinnedIds, hydrated } = usePinnedSeries();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: searchData, isLoading: searchLoading } = useSeriesSearch(debouncedSearch, 0);
  const metaResults = useMultiSeries(selectedIds);
  const obsResults = useMultiObservations(selectedIds, range);

  const datasets: AnalyzeDataset[] = selectedIds
    .map((id, i) => {
      const meta = metaResults[i]?.data?.seriess?.[0];
      const obs = obsResults[i]?.data?.observations ?? [];
      if (!meta) return null;
      return {
        seriesId: id,
        label: meta.title,
        units: meta.units_short,
        observations: obs.filter((o) => o.value !== '.' && o.value !== ''),
      };
    })
    .filter(Boolean) as AnalyzeDataset[];

  const isLoadingAny = obsResults.some((r) => r.isLoading) && selectedIds.length > 0;

  const updateUrl = useCallback(
    (ids: string[], newRange?: ObservationRange) => {
      const params = new URLSearchParams();
      if (ids.length > 0) params.set('ids', ids.join(','));
      params.set('range', newRange ?? range);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, range, router],
  );

  function addSeries(id: string) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_SERIES) return;
    updateUrl([...selectedIds, id]);
    setSearchQuery('');
  }

  function removeSeries(id: string) {
    updateUrl(selectedIds.filter((x) => x !== id));
  }

  function setRange(r: ObservationRange) {
    updateUrl(selectedIds, r);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-5 h-5" style={{ color: 'var(--accent)' }} />
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            AI Insights
          </h1>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Select up to {MAX_SERIES} FRED series and let gpt‑4o surface correlations, trends, and
          economic interpretations from your data.
        </p>
      </div>

      {/* Series picker */}
      <div>
        <div className="relative max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            ref={searchRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowPinnedDropdown(false);
            }}
            onFocus={() => {
              if (!searchQuery) setShowPinnedDropdown(true);
            }}
            placeholder={
              selectedIds.length >= MAX_SERIES
                ? `Maximum of ${MAX_SERIES} series reached`
                : 'Search to add a series…'
            }
            disabled={selectedIds.length >= MAX_SERIES}
            className="w-full pl-9 pr-16 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />
          {!searchLoading && selectedIds.length < MAX_SERIES && (
            <button
              onClick={() => {
                setShowPinnedDropdown((p) => !p);
                setSearchQuery('');
              }}
              title="Browse pinned series"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors flex items-center gap-0.5"
              style={{ color: 'var(--text-muted)' }}
            >
              <Pin className="w-3 h-3" />
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform"
                style={{
                  transform:
                    showPinnedDropdown && !searchQuery ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </button>
          )}
          {searchLoading && (
            <Loader2
              className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin"
              style={{ color: 'var(--accent)' }}
            />
          )}
        </div>

        {/* Pinned quick-pick */}
        {showPinnedDropdown && !searchQuery && hydrated && pinnedIds.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPinnedDropdown(false)} />
            <div
              className="mt-1 max-w-xl rounded-xl shadow-lg overflow-hidden z-20 relative"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
                style={{
                  background: 'var(--surface-2)',
                  color: 'var(--text-muted)',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                Pinned indicators
              </div>
              {pinnedIds.map((id) => {
                const already = selectedIds.includes(id);
                const full = selectedIds.length >= MAX_SERIES;
                return (
                  <button
                    key={id}
                    onClick={() => {
                      addSeries(id);
                      setShowPinnedDropdown(false);
                    }}
                    disabled={already || full}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 disabled:opacity-40 transition-colors"
                    style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="flex items-center gap-2">
                      <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                      <span>{id}</span>
                    </span>
                    <span
                      className="text-xs shrink-0"
                      style={{ color: already ? 'var(--accent)' : 'var(--text-muted)' }}
                    >
                      {already ? 'Added ✓' : '+ Add'}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Search results */}
        {debouncedSearch && (searchData?.seriess ?? []).length > 0 && (
          <div
            className="mt-1 max-w-xl rounded-xl shadow-lg overflow-hidden max-h-64 overflow-y-auto"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            {(searchData?.seriess ?? []).slice(0, 8).map((s) => {
              const already = selectedIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => addSeries(s.id)}
                  disabled={already || selectedIds.length >= MAX_SERIES}
                  className="w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 disabled:opacity-40 transition-colors"
                  style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span className="min-w-0 truncate">{s.title}</span>
                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--accent)' }}>
                    {already ? 'Added' : s.id}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected series chips */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.map((id, i) => (
            <span
              key={id}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
              style={{
                background:
                  'color-mix(in srgb,' + CHART_COLORS[i % CHART_COLORS.length] + ' 15%, transparent)',
                color: CHART_COLORS[i % CHART_COLORS.length],
                border: '1px solid ' + CHART_COLORS[i % CHART_COLORS.length] + '44',
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {id}
              <button onClick={() => removeSeries(id)} className="ml-0.5" title="Remove">
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Range picker */}
      {selectedIds.length > 0 && (
        <div className="flex gap-1">
          {RANGES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setRange(value)}
              className="px-3 py-1 rounded-md text-sm font-medium transition-colors"
              style={{
                background: range === value ? 'var(--accent)' : 'var(--surface)',
                color: range === value ? '#fff' : 'var(--text-muted)',
                border: '1px solid var(--border)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoadingAny && (
        <div
          className="rounded-xl p-6 flex items-center justify-center gap-2 text-sm"
          style={{ background: 'var(--surface)', color: 'var(--text-muted)' }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading series data…
        </div>
      )}

      {/* InsightsPanel */}
      {!isLoadingAny && datasets.length > 0 && (
        <InsightsPanel
          datasets={datasets}
          title={
            datasets.length === 1
              ? `AI Insights — ${datasets[0].seriesId}`
              : `AI Insights — ${datasets.length} Series`
          }
        />
      )}

      {/* Empty state */}
      {selectedIds.length === 0 && (
        <div
          className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <Sparkles className="w-8 h-8" style={{ color: 'var(--accent)', opacity: 0.5 }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
            Add 1–{MAX_SERIES} series to get started
          </p>
          <p className="text-xs max-w-sm" style={{ color: 'var(--text-muted)' }}>
            Search for any FRED series above, or click the pin icon to pick from your saved
            indicators. Then click <strong>Analyze</strong> to generate economic insights.
          </p>
        </div>
      )}
    </div>
  );
}
