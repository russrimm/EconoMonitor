'use client';

import dynamic from 'next/dynamic';
import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useMultiObservations, useMultiSeries } from '@/hooks/useFredQuery';
import { useCustomIndicators } from '@/hooks/useCustomIndicators';
import { ChartDataTable } from '@/components/charts/ChartDataTable';
import {
  alignByDate,
  compileFormula,
  evaluateAcrossDates,
  newIndicatorId,
  type CompiledFormula,
  type CustomIndicator,
  type FormulaVar,
} from '@/lib/customIndicator';

const CustomIndicatorChart = dynamic(
  () =>
    import('@/components/charts/CustomIndicatorChart').then(
      (module) => module.CustomIndicatorChart,
    ),
  { ssr: false },
);

const TEMPLATES: {
  name: string;
  units: string;
  formula: string;
  inputs: { var: FormulaVar; seriesId: string; label: string }[];
}[] = [
  {
    name: '10y–2y Treasury spread',
    units: 'pp',
    formula: 'A - B',
    inputs: [
      { var: 'A', seriesId: 'DGS10', label: '10-year Treasury' },
      { var: 'B', seriesId: 'DGS2',  label: '2-year Treasury' },
    ],
  },
  {
    name: 'Gender unemployment gap',
    units: 'pp',
    formula: 'A - B',
    inputs: [
      { var: 'A', seriesId: 'LNS14000001', label: 'Men, 20 years and over' },
      { var: 'B', seriesId: 'LNS14000002', label: 'Women, 20 years and over' },
    ],
  },
];

export default function BuilderPage() {
  const { indicators, save, remove, hydrated } = useCustomIndicators();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [units, setUnits] = useState('');
  const [formula, setFormula] = useState('A - B');
  const [varSeries, setVarSeries] = useState<Record<FormulaVar, string>>({
    A: '',
    B: '',
    C: '',
    D: '',
  });

  // Compile formula reactively to surface errors as the user types.
  const compileResult = useMemo<{
    compiled: CompiledFormula | null;
    error: string | null;
  }>(() => {
    if (!formula.trim()) return { compiled: null, error: null };
    try {
      return { compiled: compileFormula(formula), error: null };
    } catch (e) {
      return { compiled: null, error: (e as Error).message };
    }
  }, [formula]);

  const usedVars = useMemo(
    () => compileResult.compiled?.usedVars ?? [],
    [compileResult.compiled],
  );
  const activeInputs = useMemo(
    () =>
      usedVars
        .map((v) => ({ var: v, seriesId: varSeries[v].trim().toUpperCase() }))
        .filter((x) => x.seriesId !== ''),
    [usedVars, varSeries],
  );
  const activeSeriesIds = activeInputs.map((x) => x.seriesId);

  const obsResults = useMultiObservations(activeSeriesIds, 'max');
  const metaResults = useMultiSeries(activeSeriesIds);

  const allInputsFilled =
    usedVars.length > 0 && activeInputs.length === usedVars.length;
  const allObsLoaded =
    allInputsFilled && obsResults.every((r) => r.data && !r.isLoading);
  const failedInputIds = activeSeriesIds.filter(
    (_, index) => obsResults[index]?.isError || metaResults[index]?.isError,
  );
  const inputEndDates = activeInputs
    .map((input, index) => {
      const latest = (obsResults[index]?.data?.observations ?? [])
        .filter((observation) => observation.value !== '.' && observation.value !== '')
        .at(-1);
      return latest ? `${input.var}: ${latest.date}` : null;
    })
    .filter((value): value is string => value !== null);
  const hasDifferentEndDates =
    new Set(inputEndDates.map((value) => value.slice(value.indexOf(':') + 2))).size > 1;

  // Build preview points
  const previewPoints = useMemo(() => {
    if (!compileResult.compiled || !allObsLoaded) return [];
    const aligned = alignByDate(
      activeInputs.map((inp, i) => ({
        var: inp.var,
        observations: obsResults[i].data?.observations ?? [],
      })),
    );
    return evaluateAcrossDates(compileResult.compiled, aligned);
  }, [compileResult.compiled, allObsLoaded, activeInputs, obsResults]);

  const canSave =
    !!compileResult.compiled &&
    name.trim().length > 0 &&
    allInputsFilled &&
    previewPoints.length > 0;

  function resetEditor() {
    setEditingId(null);
    setName('');
    setUnits('');
    setFormula('A - B');
    setVarSeries({ A: '', B: '', C: '', D: '' });
  }

  function loadIndicator(ind: CustomIndicator) {
    setEditingId(ind.id);
    setName(ind.name);
    setUnits(ind.units);
    setFormula(ind.formula);
    const next: Record<FormulaVar, string> = { A: '', B: '', C: '', D: '' };
    for (const inp of ind.inputs) next[inp.var] = inp.seriesId;
    setVarSeries(next);
  }

  function loadTemplate(t: (typeof TEMPLATES)[number]) {
    setEditingId(null);
    setName(t.name);
    setUnits(t.units);
    setFormula(t.formula);
    const next: Record<FormulaVar, string> = { A: '', B: '', C: '', D: '' };
    for (const inp of t.inputs) next[inp.var] = inp.seriesId;
    setVarSeries(next);
  }

  function handleSave() {
    if (!canSave || !compileResult.compiled) return;
    const indicator: CustomIndicator = {
      id: editingId ?? newIndicatorId(),
      name: name.trim(),
      units: units.trim(),
      formula: formula.trim(),
      inputs: usedVars.map((v) => ({ var: v, seriesId: varSeries[v].trim().toUpperCase() })),
      createdAt: new Date().toISOString(),
    };
    save(indicator);
    setEditingId(indicator.id);
  }

  function handleDelete() {
    if (!editingId) return;
    if (!confirm('Delete this indicator?')) return;
    remove(editingId);
    resetEditor();
  }

  // Reset editor when switching to "new"
  useEffect(() => {
    if (editingId === null && indicators.length > 0 && !name && !formula.trim() && hydrated) {
      // Only auto-load on first hydration if nothing is being edited.
    }
  }, [editingId, indicators.length, name, formula, hydrated]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Indicator Builder
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
          Compose your own indicator from FRED series. Use variables{' '}
          <code style={{ color: 'var(--accent)' }}>A B C D</code>, operators{' '}
          <code style={{ color: 'var(--accent)' }}>+ - * / ^</code>, parentheses, and functions{' '}
          <code style={{ color: 'var(--accent)' }}>abs sqrt log ln exp</code>. Saved locally to your browser.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Saved list */}
        <aside className="flex flex-col gap-3">
          <button
            onClick={resetEditor}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
            style={{
              background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
              color: 'var(--accent-hover)',
              border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
            }}
          >
            <Plus className="w-4 h-4" />
            New indicator
          </button>

          {hydrated && indicators.length > 0 && (
            <div
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
            >
              <div
                className="px-3 py-2 text-xs font-medium uppercase tracking-wide"
                style={{ background: 'var(--surface-2)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
              >
                Saved
              </div>
              <ul>
                {indicators.map((ind) => (
                  <li key={ind.id}>
                    <button
                      onClick={() => loadIndicator(ind)}
                      className="w-full text-left px-3 py-2 text-sm transition-colors"
                      style={{
                        background:
                          editingId === ind.id
                            ? 'color-mix(in srgb, var(--accent) 10%, transparent)'
                            : 'transparent',
                        color:
                          editingId === ind.id ? 'var(--accent)' : 'var(--text)',
                        borderTop: '1px solid var(--border)',
                      }}
                    >
                      <div className="font-medium truncate">{ind.name}</div>
                      <div
                        className="text-xs font-mono truncate mt-0.5"
                        style={{ color: 'var(--text-muted)' }}
                      >
                        {ind.formula}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Templates */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}
          >
            <div
              className="px-3 py-2 text-xs font-medium uppercase tracking-wide"
              style={{ background: 'var(--surface-2)', color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
            >
              Templates
            </div>
            <ul>
              {TEMPLATES.map((t) => (
                <li key={t.name}>
                  <button
                    onClick={() => loadTemplate(t)}
                    className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                    style={{ color: 'var(--text)', borderTop: '1px solid var(--border)' }}
                  >
                    <div className="font-medium truncate">{t.name}</div>
                    <div
                      className="text-xs font-mono truncate mt-0.5"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {t.formula}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Editor */}
        <section className="flex flex-col gap-4" aria-label="Custom indicator editor">
          {/* Name + units */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div>
              <label htmlFor="indicator-name" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Name
              </label>
              <input
                id="indicator-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My custom indicator"
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
            <div>
              <label htmlFor="indicator-units" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Units (optional)
              </label>
              <input
                id="indicator-units"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="%"
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                }}
              />
            </div>
          </div>

          {/* Formula */}
          <div>
            <label htmlFor="indicator-formula" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Formula
            </label>
            <input
              id="indicator-formula"
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="(A - B) / B * 100"
              aria-invalid={compileResult.error ? true : undefined}
              aria-describedby="indicator-formula-status"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg focus:outline-none focus:ring-2"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${compileResult.error ? '#ef4444' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            <div
              id="indicator-formula-status"
              className="mt-1.5 flex items-center gap-1.5 text-xs"
              aria-live="polite"
            >
              {compileResult.error ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5" style={{ color: '#ef4444' }} />
                  <span style={{ color: '#ef4444' }}>{compileResult.error}</span>
                </>
              ) : compileResult.compiled ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" style={{ color: '#10b981' }} />
                  <span style={{ color: 'var(--text-muted)' }}>
                    Uses {usedVars.length === 0 ? 'no variables (constant)' : usedVars.join(', ')}
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>Enter a formula above.</span>
              )}
            </div>
          </div>

          {/* Variable → series mapping */}
          {usedVars.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {usedVars.map((v) => {
                const idx = activeSeriesIds.indexOf(varSeries[v].trim().toUpperCase());
                const meta = idx >= 0 ? metaResults[idx]?.data?.seriess?.[0] : undefined;
                return (
                  <div key={v}>
                    <label
                      htmlFor={`indicator-series-${v}`}
                      className="block text-xs font-medium mb-1"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <span
                        className="inline-block w-5 h-5 rounded-full text-center font-mono mr-1"
                        style={{
                          background: 'color-mix(in srgb, var(--accent) 14%, transparent)',
                          color: 'var(--accent)',
                          lineHeight: '20px',
                        }}
                      >
                        {v}
                      </span>
                      FRED series id
                    </label>
                    <input
                      id={`indicator-series-${v}`}
                      value={varSeries[v]}
                      onChange={(e) =>
                        setVarSeries((prev) => ({ ...prev, [v]: e.target.value }))
                      }
                      placeholder="e.g. CPIAUCSL"
                      className="w-full px-3 py-2 text-sm font-mono rounded-lg focus:outline-none focus:ring-2"
                      style={{
                        background: 'var(--surface)',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                      }}
                    />
                    {meta && (
                      <div className="mt-1 text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                        {meta.title} · {meta.frequency_short} · {meta.units_short}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Save / delete */}
          {failedInputIds.length > 0 && (
            <div className="rounded-lg px-3 py-2 text-sm" role="alert" style={{
              color: 'var(--red)',
              border: '1px solid color-mix(in srgb, var(--red) 35%, transparent)',
            }}>
              Could not load: {failedInputIds.join(', ')}.{' '}
              <button
                className="font-medium underline"
                onClick={() => {
                  for (const result of [...obsResults, ...metaResults]) {
                    if (result.isError) void result.refetch();
                  }
                }}
              >
                Retry
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {editingId ? 'Save changes' : 'Save indicator'}
            </button>
            {editingId && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium"
                style={{
                  background: 'transparent',
                  color: '#ef4444',
                  border: '1px solid color-mix(in srgb, #ef4444 40%, transparent)',
                }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>

          {/* Preview chart */}
          {compileResult.compiled && allInputsFilled && (
            <div
              className="rounded-xl p-4"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
                  Preview
                </h2>
                {previewPoints.length > 0 && (
                  <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                    {previewPoints.length.toLocaleString()} points · latest{' '}
                    {previewPoints[previewPoints.length - 1].value.toLocaleString('en-US', {
                      maximumFractionDigits: 4,
                    })}
                    {units ? ` ${units}` : ''}
                  </span>
                )}
              </div>
              <div className="h-72">
                <CustomIndicatorChart
                  points={previewPoints}
                  label={name || 'Custom indicator'}
                  units={units}
                />
              </div>
              {hasDifferentEndDates && (
                <p className="mb-2 text-xs" role="status" style={{ color: 'var(--text-muted)' }}>
                  Input series end on different dates ({inputEndDates.join(', ')}).
                  Later points carry the most recent published value forward.
                </p>
              )}
              {previewPoints.length > 0 && (
                <ChartDataTable
                  title={`${name || 'Custom indicator'} chart data`}
                  datasets={[{
                    seriesId: editingId ?? 'CUSTOM',
                    label: name || 'Custom indicator',
                    units,
                    observations: previewPoints.map((point) => ({
                      date: point.date,
                      value: String(point.value),
                    })),
                  }]}
                />
              )}
            </div>
          )}

          {/* Quick reference */}
          {!compileResult.compiled && !compileResult.error && (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
            >
              <p className="font-medium mb-2" style={{ color: 'var(--text)' }}>
                Quick examples
              </p>
              <ul className="space-y-1.5 list-disc list-inside">
                <li>
                  <code>A - B</code> — spread between two series (e.g. yield curve)
                </li>
                <li>
                  <code>(A - B) / B * 100</code> — percent change of A vs B
                </li>
                <li>
                  <code>A / B</code> — ratio (e.g. real wages, debt/GDP)
                </li>
                <li>
                  <code>A + B + C</code> — composite index of three series
                </li>
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
