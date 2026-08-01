import assert from 'node:assert/strict';
import test from 'node:test';

import {
  observationStartDate,
  parseObservationRange,
  transformedUnits,
} from '../lib/fred.ts';
import {
  applyNormalization,
  normalizationIssue,
} from '../lib/transform.ts';
import {
  buildUserPrompt,
  computeSeriesStats,
  prepareDatasetsForAnalysis,
} from '../lib/ai.ts';
import {
  isValidIsoDate,
  validateAnalyzeDatasets,
  validateChatMessages,
} from '../lib/aiValidation.ts';
import {
  hasAcceptableQueryLength,
  isAllowedFraserPath,
  isAllowedFredPath,
  validateFraserQuery,
  validateFredQuery,
} from '../lib/apiProxy.ts';
import { readLimitedJson, RequestBodyError } from '../lib/http.ts';
import {
  compileFormula,
  alignByDate,
  evaluateAcrossDates,
} from '../lib/customIndicator.ts';
import {
  parseFederalReserveUrl,
  parseGdeltArticle,
  parseGdeltDate,
  readLimitedText,
} from '../lib/news.ts';
import { datasetsToCSV } from '../lib/utils.ts';
import { scanText } from '../scripts/check-secrets.mjs';

test('observation ranges reject unknown URL values and use UTC-safe calendar dates', () => {
  assert.equal(parseObservationRange('invalid'), '5y');
  assert.equal(parseObservationRange('10y'), '10y');
  assert.equal(
    observationStartDate('1y', new Date('2024-02-29T23:30:00-08:00')),
    '2023-03-01',
  );
  assert.equal(
    observationStartDate('1y', new Date('2024-02-29T12:00:00Z')),
    '2023-02-28',
  );
});

test('start-based normalization never silently changes its base date', () => {
  const observations = [
    { date: '2024-01-01', value: '0' },
    { date: '2024-02-01', value: '2' },
  ];
  assert.match(normalizationIssue(observations, 'index100'), /zero/);
  assert.deepEqual(applyNormalization(observations, 'index100'), []);

  const valid = [
    { date: '2024-01-01', value: '2' },
    { date: '2024-02-01', value: '3' },
  ];
  assert.deepEqual(
    applyNormalization(valid, 'index100').map((point) => Number(point.value)),
    [100, 150],
  );
});

test('AI statistics calculate a date-based one-year change before prompt sampling', () => {
  const observations = [
    { date: '2023-01-01', value: '10' },
    { date: '2024-01-01', value: '14' },
    { date: '2024-07-01', value: '18' },
    { date: '2025-01-01', value: '20' },
  ];
  const stats = computeSeriesStats(observations);
  assert.equal(stats?.comparisonDate, '2024-01-01');
  assert.equal(stats?.yearChange, 6);

  const prompt = buildUserPrompt([
    { seriesId: 'TEST', label: 'Test series', units: 'Index', observations },
  ]);
  assert.match(prompt, /one-year change=\+6\.00 since 2024-01-01/);
  assert.doesNotMatch(prompt, /12-period change/);
});

test('AI payload preparation is bounded and retains the one-year anchor', () => {
  const observations = Array.from({ length: 730 }, (_, index) => {
    const date = new Date(Date.UTC(2023, 0, 1 + index)).toISOString().slice(0, 10);
    return { date, value: String(index === 123 ? 100_000 : index) };
  });
  const [prepared] = prepareDatasetsForAnalysis([
    { seriesId: 'TEST', label: 'Test', units: 'Index', observations },
  ]);
  const latest = observations.at(-1);
  const target = new Date(`${latest.date}T00:00:00Z`);
  target.setUTCFullYear(target.getUTCFullYear() - 1);

  assert.ok(prepared.observations.length <= 360);
  assert.ok(
    prepared.observations.some(
      (observation) => observation.date === target.toISOString().slice(0, 10),
    ),
  );
  const prompt = buildUserPrompt([prepared]);
  assert.match(prompt, new RegExp(`${observations[123].date},100000`));
});

test('AI validators reject malformed data while allowing multiline chat', () => {
  assert.equal(isValidIsoDate('2024-02-29'), true);
  assert.equal(isValidIsoDate('2024-02-30'), false);
  assert.equal(
    validateChatMessages({
      messages: [{ role: 'user', content: 'Line one\nLine two' }],
    }).ok,
    true,
  );
  assert.equal(
    validateAnalyzeDatasets({
      datasets: [{
        seriesId: 'GDP',
        label: 'GDP',
        units: 'Billions',
        observations: [{ date: '2024-02-30', value: '1' }],
      }],
    }).ok,
    false,
  );
});

test('API proxy allowlists expose only application-used upstream paths', () => {
  assert.equal(isAllowedFredPath('series/observations'), true);
  assert.equal(isAllowedFredPath('sources'), false);
  assert.equal(isAllowedFraserPath('timeline/abc-123/events'), true);
  assert.equal(isAllowedFraserPath('admin/secrets'), false);
  assert.equal(hasAcceptableQueryLength(`?q=${'x'.repeat(3_000)}`), false);
  assert.equal(
    validateFredQuery(
      'series/observations',
      new URLSearchParams('series_id=GDP&limit=100000&units=pc1'),
    ),
    null,
  );
  assert.match(
    validateFredQuery(
      'series/observations',
      new URLSearchParams('series_id=GDP&limit=999999999'),
    ),
    /limit/,
  );
  assert.match(
    validateFredQuery('series', new URLSearchParams('unknown=value')),
    /Unsupported/,
  );
  assert.equal(
    validateFraserQuery(new URLSearchParams('limit=200&page=2')),
    null,
  );
  assert.match(
    validateFraserQuery(new URLSearchParams('limit=201')),
    /limit/,
  );
});

test('limited JSON parsing enforces declared and streamed body sizes', async () => {
  await assert.rejects(
    () =>
      readLimitedJson(
        new Request('https://example.test', {
          method: 'POST',
          headers: { 'content-length': '100' },
          body: '{}',
        }),
        10,
      ),
    (error) => error instanceof RequestBodyError && error.status === 413,
  );

  const parsed = await readLimitedJson(
    new Request('https://example.test', {
      method: 'POST',
      body: JSON.stringify({ ok: true }),
    }),
    32,
  );
  assert.deepEqual(parsed, { ok: true });
});

test('formula parser supports negative exponents without changing unary precedence', () => {
  const row = [{ date: '2024-01-01', values: { A: 1, B: 1, C: 1, D: 1 } }];
  assert.equal(evaluateAcrossDates(compileFormula('-2^2'), row)[0].value, -4);
  assert.equal(evaluateAcrossDates(compileFormula('2^-2'), row)[0].value, 0.25);
});

test('economic units distinguish percentage-point changes', () => {
  assert.equal(transformedUnits('Percent', 'chg'), 'Percentage points');
  assert.equal(transformedUnits('%', 'ch1'), 'Percentage points');
  assert.equal(transformedUnits('Bil. of $', 'chg'), 'Bil. of $');
  assert.equal(transformedUnits('Percent', 'pch'), '% change');
});

test('custom indicator alignment preserves mixed-frequency forward filling', () => {
  const aligned = alignByDate([
    {
      var: 'A',
      observations: [
        { date: '2024-01-01', value: '1' },
        { date: '2024-02-01', value: '2' },
        { date: '2024-03-01', value: '3' },
      ],
    },
    {
      var: 'B',
      observations: [
        { date: '2024-01-01', value: '10' },
        { date: '2024-02-01', value: '20' },
      ],
    },
  ]);
  assert.deepEqual(aligned.map((row) => row.date), [
    '2024-01-01',
    '2024-02-01',
    '2024-03-01',
  ]);
});

test('news parsing rejects malformed dates, records, and deceptive links', async () => {
  assert.equal(parseGdeltDate('20260231T000000Z'), null);
  assert.equal(parseGdeltArticle(null), null);
  assert.equal(
    parseGdeltArticle({
      url: 'https://example.com/story',
      title: 'Headline',
      seendate: '20260228T120000Z',
      domain: 'spoofed.example',
    })?.source,
    'example.com',
  );
  assert.equal(parseFederalReserveUrl('javascript:alert(1)'), null);
  assert.equal(parseFederalReserveUrl('https://example.com/fed'), null);
  assert.match(
    parseFederalReserveUrl('https://www.federalreserve.gov/newsevents.htm'),
    /^https:\/\/www\.federalreserve\.gov\//,
  );

  await assert.rejects(
    () =>
      readLimitedText(
        new Response('too large', {
          headers: { 'content-length': '9' },
        }),
        4,
      ),
    /size limit/,
  );
});

test('multi-series CSV exports preserve series identity and units', () => {
  const csv = datasetsToCSV([
    {
      seriesId: 'GDP',
      label: 'Gross Domestic Product',
      units: 'Index (start = 100)',
      observations: [{ date: '2024-01-01', value: '100' }],
    },
    {
      seriesId: 'UNRATE',
      label: 'Unemployment Rate',
      units: 'Percentage points',
      observations: [{ date: '2024-01-01', value: '4.1' }],
    },
  ]);
  assert.match(csv, /"GDP","Gross Domestic Product","Index \(start = 100\)",100/);
  assert.match(csv, /"UNRATE","Unemployment Rate","Percentage points",4\.1/);
});

test('secret-pattern scanner reports locations without retaining matched values', () => {
  const token = ['gh', 'p_', 'a'.repeat(36)].join('');
  const findings = scanText(`placeholder\nTOKEN=${token}\n`);

  assert.deepEqual(findings, [
    { detector: 'GitHub personal access token', line: 2 },
  ]);
  assert.equal(JSON.stringify(findings).includes(token), false);
  assert.deepEqual(scanText('GITHUB_TOKEN=<your-github-models-token>'), []);
});
