'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Loader2, Pin, Search, X } from 'lucide-react';
import { useMultiObservations, useMultiSeries, useSeriesSearch } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import { CompareChart, type CompareDataset } from '@/components/charts/CompareChart';
import { ExportButton } from '@/components/ExportButton';
import { InsightsPanel } from '@/components/ai/InsightsPanel';
import { CHART_COLORS } from '@/lib/utils';
import type { ObservationRange } from '@/lib/fred';
import type { AnalyzeDataset } from '@/lib/ai';

const MAX_SERIES = 6;

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <ComparePageInner />
    </Suspense>
  );
}

const RANGES: { label: string; value: ObservationRange }[] = [
  { label: '1Y', value: '1y' },
  { label: '5Y', value: '5y' },
  { label: '10Y', value: '10y' },
  { label: 'Max', value: 'max' },
];

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const selectedIds = (searchParams.get('ids') ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SERIES);

  const range = (searchParams.get('range') ?? '5y') as ObservationRange;

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showPinnedDropdown, setShowPinnedDropdown] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const { pinned: pinnedIds, hydrated } = usePinnedSeries();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const { data: searchData, isLoading: searchLoading } = useSeriesSearch(
    debouncedSearch,
    0,
  );

  // Fetch all selected series metadata + observations in parallel
  const metaResults = useMultiSeries(selectedIds);
  const obsResults = useMultiObservations(selectedIds, range);

  // Fetch pinned series metadata so the dropdown can show friendly titles
  const pinnedMetaResults = useMultiSeries(pinnedIds);

  // Build compare datasets
  const datasets: CompareDataset[] = selectedIds
    .map((id, i) => {
      const meta = metaResults[i]?.data?.seriess?.[0];
      const obs = obsResults[i]?.data?.observations ?? [];
      if (!meta) return null;
      return {
        seriesId: id,
        label: meta.title,
        units: meta.units_short,
        observations: obs,
      };
    })
    .filter(Boolean) as CompareDataset[];

  const isLoadingAny = obsResults.some((r) => r.isLoading);

  // URL manipulation helpers
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

  // Flatten all valid observations for multi-export
  const allObservations = obsResults.flatMap((r) =>
    (r.data?.observations ?? []).filter((o) => o.value !== '.'),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Compare Series
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Overlay up to {MAX_SERIES} economic series on a single chart. Series with
          different units get separate Y-axes.
        </p>
      </div>

      {/* Series search + add */}
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
          {/* Pinned series chevron button */}
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
                style={{ transform: showPinnedDropdown && !searchQuery ? 'rotate(180deg)' : 'rotate(0deg)' }}
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

        {/* Pinned series quick-pick dropdown */}
        {showPinnedDropdown && !searchQuery && hydrated && pinnedIds.length > 0 && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowPinnedDropdown(false)} />
            <div
              className="mt-1 max-w-xl rounded-xl shadow-lg overflow-hidden z-20 relative"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide"
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
              >
                Pinned indicators
              </div>
              {pinnedIds.map((id, i) => {
                const already = selectedIds.includes(id);
                const full = selectedIds.length >= MAX_SERIES;
                const pinnedTitle = pinnedMetaResults[i]?.data?.seriess?.[0]?.title;
                return (
                  <button
                    key={id}
                    onClick={() => { addSeries(id); setShowPinnedDropdown(false); }}
                    disabled={already || full}
                    className="w-full px-4 py-2.5 text-left text-sm flex items-center justify-between gap-3 disabled:opacity-40 transition-colors"
                    style={{ borderTop: '1px solid var(--border)', color: 'var(--text)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span className="min-w-0 flex items-center gap-2">
                      <Pin className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--accent)' }} />
                      <span className="min-w-0">
                        <span className="block truncate">{pinnedTitle ?? id}</span>
                      </span>
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

        {/* Search results dropdown */}
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
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = 'var(--surface-2)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = 'transparent')
                  }
                >
                  <span className="min-w-0 truncate">{s.title}</span>
                  <span
                    className="text-xs font-mono shrink-0"
                    style={{ color: 'var(--accent)' }}
                  >
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
                background: 'color-mix(in srgb,' + CHART_COLORS[i % CHART_COLORS.length] + ' 15%, transparent)',
                color: CHART_COLORS[i % CHART_COLORS.length],
                border: '1px solid ' + CHART_COLORS[i % CHART_COLORS.length] + '44',
              }}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {id}
              <button
                onClick={() => removeSeries(id)}
                className="ml-0.5"
                title="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Chart controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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

        {datasets.length > 0 && allObservations.length > 0 && (
          <ExportButton
            seriesId={selectedIds.join('_')}
            title={`Compare: ${selectedIds.join(', ')}`}
            observations={allObservations}
          />
        )}
      </div>

      {/* Chart */}
      <div
        className="rounded-xl p-4"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="h-96 relative">
          {isLoadingAny && selectedIds.length > 0 ? (
            <div
              className="h-full rounded-xl flex items-center justify-center gap-2"
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading data…
            </div>
          ) : (
            <CompareChart datasets={datasets} />
          )}
        </div>
      </div>

      {/* AI Insights */}
      {datasets.length > 0 && (
        <InsightsPanel
          datasets={datasets.map((d): AnalyzeDataset => ({
            seriesId: d.seriesId,
            label: d.label,
            units: d.units,
            observations: d.observations,
          }))}
          title="AI Insights — Multi-Series Analysis"
        />
      )}
    </div>
  );
}
