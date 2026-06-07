'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { useMultiObservations, useMultiSeries } from '@/hooks/useFredQuery';
import { useCustomIndicators } from '@/hooks/useCustomIndicators';
import { CustomIndicatorChart } from '@/components/charts/CustomIndicatorChart';
import {
  alignByDate,
  compileFormula,
  evaluateAcrossDates,
  FORMULA_VARS,
  newIndicatorId,
  type CompiledFormula,
  type CustomIndicator,
  type FormulaVar,
} from '@/lib/customIndicator';

const TEMPLATES: {
  name: string;
  units: string;
  formula: string;
  inputs: { var: FormulaVar; seriesId: string; label: string }[];
}[] = [
  {
    name: 'Real wages (YoY %)',
    units: '%',
    formula: '(A / B - 1) * 100',
    inputs: [
      { var: 'A', seriesId: 'AHETPI',   label: 'Avg hourly earnings, production workers' },
      { var: 'B', seriesId: 'CPIAUCSL', label: 'CPI All Urban Consumers' },
    ],
  },
  {
    name: 'Misery index',
    units: '%',
    formula: 'A + B',
    inputs: [
      { var: 'A', seriesId: 'UNRATE',   label: 'Unemployment rate' },
      { var: 'B', seriesId: 'CPIAUCSL', label: 'CPI (use a YoY % series for accuracy)' },
    ],
  },
  {
    name: '10y–2y Treasury spread',
    units: 'pp',
    formula: 'A - B',
    inputs: [
      { var: 'A', seriesId: 'DGS10', label: '10-year Treasury' },
      { var: 'B', seriesId: 'DGS2',  label: '2-year Treasury' },
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

  const usedVars = compileResult.compiled?.usedVars ?? [];
  const activeInputs = usedVars
    .map((v) => ({ var: v, seriesId: varSeries[v].trim().toUpperCase() }))
    .filter((x) => x.seriesId !== '');
  const activeSeriesIds = activeInputs.map((x) => x.seriesId);

  const obsResults = useMultiObservations(activeSeriesIds, 'max');
  const metaResults = useMultiSeries(activeSeriesIds);

  const allInputsFilled =
    usedVars.length > 0 && activeInputs.length === usedVars.length;
  const allObsLoaded =
    allInputsFilled && obsResults.every((r) => r.data && !r.isLoading);

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
              color: 'var(--accent)',
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
                style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
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
              style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}
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
        <main className="flex flex-col gap-4">
          {/* Name + units */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Name
              </label>
              <input
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
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                Units (optional)
              </label>
              <input
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
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
              Formula
            </label>
            <input
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
              placeholder="(A - B) / B * 100"
              className="w-full px-3 py-2 text-sm font-mono rounded-lg focus:outline-none focus:ring-2"
              style={{
                background: 'var(--surface)',
                border: `1px solid ${compileResult.error ? '#ef4444' : 'var(--border)'}`,
                color: 'var(--text)',
              }}
            />
            <div className="mt-1.5 flex items-center gap-1.5 text-xs">
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
        </main>
      </div>
    </div>
  );
}
