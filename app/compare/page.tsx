'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Loader2, Pin, Search, X } from 'lucide-react';
import { useMultiObservations, useMultiSeries, useSeriesSearch } from '@/hooks/useFredQuery';
import { usePinnedSeries } from '@/hooks/usePinnedSeries';
import type {
  CompareChartProps,
  CompareDataset,
} from '@/components/charts/CompareChart';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import { ExportButton } from '@/components/ExportButton';
import { TransformControls } from '@/components/controls/TransformControls';
import { NormalizeControl } from '@/components/controls/NormalizeControl';
import { InsightsPanel } from '@/components/ai/InsightsPanel';
import { CHART_COLORS } from '@/lib/utils';
import {
  TRANSFORM_MAP,
  transformSuffix,
  transformedUnits,
  parseObservationRange,
  type FredUnits,
  type ObservationRange,
} from '@/lib/fred';
import {
  NORMALIZE_MAP,
  applyNormalization,
  isSharedAxis,
  normalizationIssue,
  normalizedUnits,
  type NormalizeMode,
} from '@/lib/transform';
import type { AnalyzeDataset } from '@/lib/ai';

const MAX_SERIES = 6;

const CompareChart = dynamic<CompareChartProps>(
  () => import('@/components/charts/CompareChart').then((module) => module.CompareChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-64 items-center justify-center rounded-xl text-sm"
        role="status"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
      >
        Loading interactive chart…
      </div>
    ),
  },
);

const VALID_UNITS = new Set(Object.keys(TRANSFORM_MAP));
const VALID_NORMS = new Set(Object.keys(NORMALIZE_MAP));

/** Emphasised gridline for each normalization mode. */
const BASELINE: Record<NormalizeMode, number | null> = {
  none: null,
  index100: 100,
  pctFromStart: 0,
  zscore: 0,
};

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

  const selectedIds = [
    ...new Set(
      (searchParams.get('ids') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((id) => /^[A-Z0-9_-]{1,30}$/.test(id)),
    ),
  ].slice(0, MAX_SERIES);

  const range = parseObservationRange(searchParams.get('range'));

  const unitsParam = searchParams.get('units') ?? 'lin';
  const units = (VALID_UNITS.has(unitsParam) ? unitsParam : 'lin') as FredUnits;

  const normParam = searchParams.get('norm') ?? 'none';
  const normalize = (VALID_NORMS.has(normParam) ? normParam : 'none') as NormalizeMode;

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
  const obsResults = useMultiObservations(selectedIds, range, { units });

  // Fetch pinned series metadata so the dropdown can show friendly titles
  const pinnedMetaResults = useMultiSeries(pinnedIds);

  // Build compare datasets: FRED transform first (server-side, changes what the
  // series measures), then normalization (client-side, changes only its scale).
  const normalizationWarnings: string[] = [];
  const datasets: CompareDataset[] = selectedIds
    .map((id, i) => {
      const meta = metaResults[i]?.data?.seriess?.[0];
      const obs = obsResults[i]?.data?.observations ?? [];
      if (!meta) return null;
      const issue = normalizationIssue(obs, normalize);
      if (issue) normalizationWarnings.push(`${id}: ${issue}`);
      const normalizedObservations = applyNormalization(obs, normalize);
      if (normalizedObservations.length === 0) return null;
      return {
        seriesId: id,
        label: `${meta.title}${transformSuffix(units)}`,
        units: transformedUnits(meta.units_short, units),
        observations: normalizedObservations,
      };
    })
    .filter(Boolean) as CompareDataset[];

  const isLoadingAny = [...metaResults, ...obsResults].some((r) => r.isLoading);
  const failedIds = selectedIds.filter(
    (_, index) => metaResults[index]?.isError || obsResults[index]?.isError,
  );

  const sharedAxisLabel = isSharedAxis(normalize)
    ? NORMALIZE_MAP[normalize].axisLabel
    : null;

  // URL manipulation helpers
  function updateUrl(
    ids: string[],
    next: { range?: ObservationRange; units?: FredUnits; normalize?: NormalizeMode } = {},
  ) {
    const params = new URLSearchParams();
    if (ids.length > 0) params.set('ids', ids.join(','));
    params.set('range', next.range ?? range);
    const nextUnits = next.units ?? units;
    if (nextUnits !== 'lin') params.set('units', nextUnits);
    const nextNorm = next.normalize ?? normalize;
    if (nextNorm !== 'none') params.set('norm', nextNorm);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function addSeries(id: string) {
    if (selectedIds.includes(id) || selectedIds.length >= MAX_SERIES) return;
    updateUrl([...selectedIds, id]);
    setSearchQuery('');
  }

  function removeSeries(id: string) {
    updateUrl(selectedIds.filter((x) => x !== id));
  }

  function setRange(r: ObservationRange) {
    updateUrl(selectedIds, { range: r });
  }

  function setUnits(u: FredUnits) {
    updateUrl(selectedIds, { units: u });
  }

  function setNormalize(n: NormalizeMode) {
    updateUrl(selectedIds, { normalize: n });
  }

  const exportDatasets = datasets.map((dataset) => ({
    ...dataset,
    units: normalizedUnits(dataset.units, normalize),
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Compare Series
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Overlay up to {MAX_SERIES} economic series on a single chart. Apply a FRED
          transformation to change what the series measure, or rescale them so
          different units share one axis.
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
            aria-label="Search for a FRED series to compare"
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
              className="absolute right-2 top-1/2 -translate-y-1/2 min-h-6 min-w-6 p-1 rounded transition-colors flex items-center justify-center gap-0.5"
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
                color: 'var(--text)',
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
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex gap-1">
            {RANGES.map(({ label, value }) => (
              <button
                key={value}
                onClick={() => setRange(value)}
                aria-pressed={range === value}
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

          <TransformControls units={units} onUnitsChange={setUnits} />
          <NormalizeControl mode={normalize} onChange={setNormalize} />
        </div>

        {exportDatasets.length > 0 && (
          <ExportButton
            seriesId={selectedIds.join('_')}
            title={`Compare: ${selectedIds.join(', ')}${transformSuffix(units)} — ${NORMALIZE_MAP[normalize].label}`}
            observations={[]}
            datasets={exportDatasets}
          />
        )}
      </div>

      {/* Chart */}
      <div
        className="rounded-xl p-4 flex flex-col gap-2"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        {normalize !== 'none' && datasets.length > 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {NORMALIZE_MAP[normalize].description}
          </p>
        )}
        {normalizationWarnings.length > 0 && (
          <div
            className="rounded-lg px-3 py-2 text-xs"
            role="alert"
            style={{
              color: 'var(--red)',
              background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            }}
          >
            {normalizationWarnings.join(' ')}
          </div>
        )}
        {failedIds.length > 0 && (
          <div
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-xs"
            role="alert"
            style={{
              color: 'var(--red)',
              background: 'color-mix(in srgb, var(--red) 10%, transparent)',
            }}
          >
            <span>Could not load: {failedIds.join(', ')}.</span>
            <button
              onClick={() => {
                for (const result of [...metaResults, ...obsResults]) {
                  if (result.isError) void result.refetch();
                }
              }}
              className="font-medium underline"
            >
              Retry
            </button>
          </div>
        )}
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
            <CompareChart
              datasets={datasets}
              sharedAxisLabel={sharedAxisLabel}
              baseline={BASELINE[normalize]}
            />
          )}
        </div>
        {!isLoadingAny && datasets.length > 0 && (
          <ChartDataTable
            title="Comparison chart data"
            datasets={datasets.map((dataset) => ({
              ...dataset,
              units: normalizedUnits(dataset.units, normalize),
            }))}
          />
        )}
      </div>

      {/* AI Insights */}
      {!isLoadingAny && datasets.length > 0 && (
        <InsightsPanel
          datasets={datasets.map((d): AnalyzeDataset => ({
            seriesId: d.seriesId,
            label: d.label,
            units: normalizedUnits(d.units, normalize),
            observations: d.observations,
          }))}
          title="AI Insights — Multi-Series Analysis"
        />
      )}
    </div>
  );
}
