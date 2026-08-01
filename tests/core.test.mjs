import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  fraserOperationName,
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
} from '../lib/news.ts';
import {
  fetchUpstream,
  logUpstreamSuccess,
  readLimitedJson as readLimitedUpstreamJson,
  readLimitedText,
} from '../lib/upstream.ts';
import {
  formatFraserDate,
} from '../lib/fraser.ts';
import { readBoundedResponseText } from '../lib/responseBody.ts';
import {
  isIsoDate as isValidUpstreamDate,
  validateFraserPayload,
  validateFredPayload,
} from '../lib/upstreamSchemas.ts';
import { datasetsToCSV, localCalendarDate } from '../lib/utils.ts';
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
  assert.equal(
    fraserOperationName('title/user-supplied-id/items'),
    'title/:id/items',
  );
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

test('bounded upstream responses reject declared and streamed overages', async () => {
  const declaredOversize = new Response('small', {
    headers: { 'content-length': '100' },
  });
  await assert.rejects(
    () => readBoundedResponseText(declaredOversize, 10),
    /size limit/,
  );
  assert.equal(declaredOversize.body.locked, false);

  const response = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('123456'));
        controller.enqueue(new TextEncoder().encode('789012'));
        controller.close();
      },
    }),
  );
  await assert.rejects(() => readBoundedResponseText(response, 10), /size limit/);
  assert.equal(response.body.locked, false);
});

test('upstream observability emits redacted terminal events for every outcome', async () => {
  const originalFetch = globalThis.fetch;
  const originalInfo = console.info;
  const events = [];
  console.info = (message) => events.push(JSON.parse(message));
  const sensitiveValues = [
    'https://example.test/private?query=user-search',
    'user-search',
    'GDP-USER-SERIES',
    'payload-fragment',
    'credential-placeholder',
    'person@example.test',
  ];
  const context = {
    service: 'fred',
    operation: 'series',
    timeoutMs: 1_000,
    cachePolicy: 'no-store',
  };
  const rejectOnAbort = (_input, init) =>
    new Promise((_resolve, reject) => {
      const watchdog = setTimeout(
        () => reject(new Error('fetch mock was not aborted')),
        100,
      );
      const rejectAbort = () => {
        clearTimeout(watchdog);
        reject(new DOMException('request aborted', 'AbortError'));
      };
      if (init.signal.aborted) rejectAbort();
      else init.signal.addEventListener('abort', rejectAbort, { once: true });
    });

  try {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ value: 'payload-fragment' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const response = await fetchUpstream(
      new URL(sensitiveValues[0]),
      {
        cache: 'no-store',
        headers: { Authorization: 'Bearer credential-placeholder' },
      },
      context,
    );
    assert.equal(events.length, 0);
    assert.deepEqual(await readLimitedUpstreamJson(response, 100), {
      value: 'payload-fragment',
    });
    assert.equal(events.length, 0);
    logUpstreamSuccess(response);
    logUpstreamSuccess(response);

    globalThis.fetch = async () =>
      new Response('person@example.test payload-fragment', { status: 503 });
    await fetchUpstream(sensitiveValues[0], { cache: 'no-store' }, context);

    globalThis.fetch = async () =>
      new Response('payload-fragment', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const invalidResponse = await fetchUpstream(
      sensitiveValues[0],
      { cache: 'no-store' },
      context,
    );
    await assert.rejects(() => readLimitedUpstreamJson(invalidResponse, 100));

    globalThis.fetch = async () => {
      throw new Error(`network failure at ${sensitiveValues[0]}`);
    };
    await assert.rejects(() =>
      fetchUpstream(sensitiveValues[0], { cache: 'no-store' }, context),
    );

    globalThis.fetch = rejectOnAbort;
    await assert.rejects(() =>
      fetchUpstream(
        sensitiveValues[0],
        { cache: 'no-store' },
        { ...context, timeoutMs: 5 },
      ),
    );

    const controller = new AbortController();
    controller.abort('GDP-USER-SERIES');
    await assert.rejects(() =>
      fetchUpstream(
        sensitiveValues[0],
        { cache: 'no-store', signal: controller.signal },
        context,
      ),
    );

    assert.deepEqual(
      events.map((event) => event.outcome),
      ['success', 'http_error', 'invalid_payload', 'network_error', 'timeout', 'aborted'],
    );
    assert.equal(events.every((event) => event.event === 'upstream_request'), true);
    assert.equal(events.every((event) => event.cacheOutcome !== undefined), true);

    const serializedEvents = JSON.stringify(events);
    for (const sensitive of sensitiveValues) {
      assert.equal(serializedEvents.includes(sensitive), false);
    }
    for (const event of events) {
      assert.equal(
        Object.keys(event).some((key) =>
          /(url|query|payload|credential|token|authorization|series.?id|email|pii)/i.test(key),
        ),
        false,
      );
    }
  } finally {
    globalThis.fetch = originalFetch;
    console.info = originalInfo;
  }
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

test('FRED success payload validation rejects malformed 200 responses', async () => {
  const series = {
    id: 'GDP',
    title: 'Gross Domestic Product',
    frequency: 'Quarterly',
    frequency_short: 'Q',
    units: 'Billions of Dollars',
    units_short: 'Bil. of $',
    seasonal_adjustment: 'Seasonally Adjusted Annual Rate',
    seasonal_adjustment_short: 'SAAR',
    observation_start: '1947-01-01',
    observation_end: '2026-04-01',
    last_updated: '2026-07-30 07:55:01-05',
    popularity: 90,
  };
  const validPayloads = new Map([
    ['series', { seriess: [series] }],
    ['series/search', { seriess: [series], count: 1, offset: 0, limit: 20 }],
    ['category/series', { seriess: [series], count: 1, offset: 0, limit: 20 }],
    ['series/observations', {
      observations: [
        { date: '2026-04-01', value: '31234.5' },
        { date: '2026-07-01', value: '.' },
      ],
      count: 2,
    }],
    ['category', { categories: [{ id: 1, name: 'Money', parent_id: 0 }] }],
    ['category/children', { categories: [{ id: 1, name: 'Money', parent_id: 0 }] }],
    ['releases', {
      releases: [{ id: 1, name: 'GDP', press_release: true }],
      count: 1,
      offset: 0,
      limit: 50,
    }],
    ['releases/dates', {
      release_dates: [{ release_id: 1, release_name: 'GDP', date: '2026-08-01' }],
    }],
  ]);
  for (const [path, payload] of validPayloads) {
    assert.equal(validateFredPayload(path, payload), true, path);
  }
  assert.equal(
    validateFredPayload('series', {
      seriess: [{ ...series, notes: { unsafe: true } }],
    }),
    false,
  );

  const malformed200 = new Response(
    JSON.stringify({ observations: [{ date: '2026-02-30', value: null }], count: 1 }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
  const malformedPayload = await readLimitedUpstreamJson(malformed200, 1024);
  assert.equal(
    validateFredPayload('series/observations', malformedPayload),
    false,
  );
});

test('FRASER success payload validation rejects malformed 200 responses', async () => {
  const envelope = (records) => ({
    format: 'json',
    page: 1,
    limit: 20,
    total: records.length,
    start: 1,
    records,
  });
  const recordInfo = { recordIdentifier: ['123'], recordType: 'title' };
  const theme = {
    titleInfo: [{ title: 'Banking' }],
    recordInfo,
    location: { url: ['https://fraser.stlouisfed.org/theme/1'] },
  };
  const record = {
    titleInfo: [{ title: 'Annual Report' }],
    recordInfo,
    location: { pdfUrl: ['https://fraser.stlouisfed.org/files/report.pdf'] },
  };
  const timeline = {
    id: 'timeline-1',
    url: 'https://fraser.stlouisfed.org/timeline/1',
    title: 'Financial History',
  };
  const event = {
    title: 'Policy event',
    date: '2026-03-01',
    location: { url: ['https://fraser.stlouisfed.org/event/1'] },
  };

  assert.equal(validateFraserPayload('theme', envelope([theme])), true);
  assert.equal(validateFraserPayload('theme/1', envelope([theme])), true);
  assert.equal(validateFraserPayload('theme/1/records', envelope([record])), true);
  assert.equal(validateFraserPayload('timeline', envelope([timeline])), true);
  assert.equal(validateFraserPayload('timeline/1', envelope([timeline])), true);
  assert.equal(validateFraserPayload('timeline/1/events', envelope([event])), true);
  assert.equal(validateFraserPayload('title/1', envelope([record])), true);
  assert.equal(validateFraserPayload('title/1/items', envelope([record])), true);
  assert.equal(validateFraserPayload('item/1', envelope([record])), true);
  assert.equal(
    validateFraserPayload('theme', envelope([{
      ...theme,
      subject: { topic: {} },
    }])),
    false,
  );
  assert.equal(
    validateFraserPayload('timeline', envelope([{
      ...timeline,
      abstract: {},
    }])),
    false,
  );
  assert.equal(
    validateFraserPayload('timeline/1/events', envelope([{
      ...event,
      date: '2024-02-31',
    }])),
    false,
  );
  assert.equal(
    validateFraserPayload('title/1', envelope([{
      ...record,
      originInfo: { dateIssued: [{}] },
    }])),
    false,
  );

  const malformed200 = new Response(
    JSON.stringify(envelope([{
      titleInfo: [{ title: 'Unsafe record' }],
      recordInfo,
      location: { pdfUrl: ['javascript:alert(1)'] },
    }])),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
  const malformedPayload = await readLimitedUpstreamJson(malformed200, 2048);
  assert.equal(validateFraserPayload('title/1', malformedPayload), false);
});

test('upstream date validation is UTC-safe at month, leap-day, and DST boundaries', () => {
  assert.equal(isValidUpstreamDate('2024-02-29'), true);
  assert.equal(isValidUpstreamDate('2023-02-29'), false);
  assert.equal(isValidUpstreamDate('2026-04-31'), false);
  assert.equal(isValidUpstreamDate('2026-03-08'), true);
  assert.equal(isValidUpstreamDate('2026-11-01'), true);
});

test('FRASER period labels preserve month, quarter, and DST boundary dates', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    assert.equal(formatFraserDate('2024-03-31'), 'March 31, 2024');
    assert.equal(formatFraserDate('2024-06-30'), 'June 30, 2024');
    assert.equal(formatFraserDate('2024-03-10'), 'March 10, 2024');
    assert.equal(formatFraserDate('2024-11-03'), 'November 3, 2024');
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('local calendar dates do not cross the user day at UTC midnight', () => {
  const originalTimezone = process.env.TZ;
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(
      localCalendarDate(new Date('2026-07-01T00:30:00Z')),
      '2026-06-30',
    );
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
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

// A machine-level ~/.npmrc pointing at an internal Microsoft package proxy
// silently rewrites every `resolved` URL during install, which corrupts
// provenance for this public repository and breaks `npm ci` for outside
// contributors who cannot reach that feed. The root .npmrc pins the public
// registry; these tests fail if a contaminated lockfile is ever committed.
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const internalFeed =
  /ms-feed-\d+\.pkgs\.visualstudio\.com|packagefeedproxy\.microsoft\.io|pkgs\.dev\.azure\.com/gi;

test('package-lock.json resolves only to the public npm registry', () => {
  const lockfile = join(repoRoot, 'package-lock.json');
  assert.equal(existsSync(lockfile), true, 'package-lock.json is missing');

  const matches = readFileSync(lockfile, 'utf8').match(internalFeed) ?? [];
  assert.deepEqual(
    [...new Set(matches)],
    [],
    'package-lock.json contains internal package-feed URLs; regenerate it with ' +
      '`npm install --registry=https://registry.npmjs.org`',
  );
});

test('.npmrc pins the public npm registry', () => {
  const npmrc = join(repoRoot, '.npmrc');
  assert.equal(
    existsSync(npmrc),
    true,
    'no .npmrc; npm reads project config from the working directory and does ' +
      'not walk up the tree, so the install root needs its own declaration',
  );
  assert.match(
    readFileSync(npmrc, 'utf8'),
    /^\s*registry\s*=\s*https:\/\/registry\.npmjs\.org\/?\s*$/m,
  );
});
