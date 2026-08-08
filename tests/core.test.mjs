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
  calculateSpreads,
  parseReferenceRates,
  parseSofrAverages,
  parseTreasuryDate,
  parseYieldCurveXml,
  treasuryMonthParameter,
} from '../lib/rates.ts';
import {
  findComparison,
  groupEiaRows,
  parseEiaPeriod,
  percentChange,
} from '../lib/energy.ts';
import {
  buildCensusIndicator,
  CENSUS_INDICATORS,
  isBeaStateFips,
  parseBeaValue,
  parseCensusPeriod,
  parseCensusTimeseries,
  parseStateGdp,
} from '../lib/regional.ts';
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
import { buildSecurityHeaders } from '../lib/securityHeaders.ts';

test('security headers prevent embedding and restrict browser capabilities', () => {
  const production = new Map(
    buildSecurityHeaders(true).map(({ key, value }) => [key, value]),
  );
  const csp = production.get('Content-Security-Policy') ?? '';

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /upgrade-insecure-requests/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.equal(production.get('X-Content-Type-Options'), 'nosniff');
  assert.match(production.get('Strict-Transport-Security') ?? '', /max-age=63072000/);

  const developmentCsp =
    buildSecurityHeaders(false).find(({ key }) => key === 'Content-Security-Policy')?.value ?? '';
  assert.match(developmentCsp, /unsafe-eval/);
  assert.doesNotMatch(developmentCsp, /upgrade-insecure-requests/);
});

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

const TREASURY_XML_FIXTURE = `<?xml version="1.0" encoding="utf-8" standalone="yes" ?>
<feed xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata" xmlns="http://www.w3.org/2005/Atom">
<entry><content type="application/xml"><m:properties>
<d:NEW_DATE m:type="Edm.DateTime">2026-08-06T00:00:00</d:NEW_DATE>
<d:BC_3MONTH m:type="Edm.Double">3.85</d:BC_3MONTH>
<d:BC_2YEAR m:type="Edm.Double">4.15</d:BC_2YEAR>
<d:BC_5YEAR m:type="Edm.Double">4.30</d:BC_5YEAR>
<d:BC_10YEAR m:type="Edm.Double">4.60</d:BC_10YEAR>
<d:BC_30YEAR m:type="Edm.Double">5.15</d:BC_30YEAR>
</m:properties></content></entry>
<entry><content type="application/xml"><m:properties>
<d:NEW_DATE m:type="Edm.DateTime">2026-08-07T00:00:00</d:NEW_DATE>
<d:BC_3MONTH m:type="Edm.Double">3.87</d:BC_3MONTH>
<d:BC_2YEAR m:type="Edm.Double">4.19</d:BC_2YEAR>
<d:BC_5YEAR m:type="Edm.Double">4.35</d:BC_5YEAR>
<d:BC_10YEAR m:type="Edm.Double">4.65</d:BC_10YEAR>
<d:BC_20YEAR m:type="Edm.Double"></d:BC_20YEAR>
<d:BC_30YEAR m:type="Edm.Double">5.19</d:BC_30YEAR>
</m:properties></content></entry>
<entry><content type="application/xml"><m:properties>
<d:NEW_DATE m:type="Edm.DateTime">2026-08-08T00:00:00</d:NEW_DATE>
<d:BC_3MONTH m:type="Edm.Double">3.90</d:BC_3MONTH>
</m:properties></content></entry>
</feed>`;

test('Treasury yield curves parse in date order and drop unusable days', () => {
  const snapshots = parseYieldCurveXml(TREASURY_XML_FIXTURE);

  // The third entry carries a single maturity, which cannot be drawn as a curve.
  assert.equal(snapshots.length, 2);
  assert.deepEqual(
    snapshots.map((snapshot) => snapshot.date),
    ['2026-08-06', '2026-08-07'],
  );

  const latest = snapshots.at(-1);
  // The empty 20Y element is skipped rather than becoming NaN.
  assert.deepEqual(
    latest.points.map((point) => point.label),
    ['3M', '2Y', '5Y', '10Y', '30Y'],
  );
  // Maturities must stay ascending so the curve is drawn left to right.
  const months = latest.points.map((point) => point.months);
  assert.deepEqual(months, [...months].sort((a, b) => a - b));
});

test('Treasury dates are read as calendar days rather than local timestamps', () => {
  // A naive timestamp must not shift a day backwards west of UTC.
  assert.equal(parseTreasuryDate('2026-08-07T00:00:00'), '2026-08-07');
  assert.equal(parseTreasuryDate('2026-08-06'), '2026-08-06');
  assert.equal(parseTreasuryDate('2026-02-30'), null);
  assert.equal(parseTreasuryDate('not-a-date'), null);
});

test('yield spreads are reported in whole basis points and flag inversion', () => {
  const snapshots = parseYieldCurveXml(TREASURY_XML_FIXTURE);
  const spreads = calculateSpreads(snapshots.at(-1));

  const twosTens = spreads.find((spread) => spread.label === '10Y − 2Y');
  // 4.65 - 4.19 is 0.46000000000000085 in binary floating point.
  assert.equal(twosTens.basisPoints, 46);

  const inverted = calculateSpreads({
    date: '2026-08-07',
    points: [
      { label: '2Y', months: 24, percent: 4.8 },
      { label: '10Y', months: 120, percent: 4.3 },
    ],
  });
  assert.equal(inverted[0].basisPoints, -50);
});

test('Treasury month parameters roll back across year boundaries in UTC', () => {
  const january = new Date('2026-01-15T00:00:00Z');
  assert.equal(treasuryMonthParameter(january), '202601');
  assert.equal(treasuryMonthParameter(january, -1), '202512');
  assert.equal(treasuryMonthParameter(january, -12), '202501');
});

test('New York Fed reference rates keep display order and separate SOFR averages', () => {
  const payload = {
    refRates: [
      { effectiveDate: '2026-08-07', type: 'SOFRAI', average30day: 3.62347, index: 1.25 },
      { effectiveDate: '2026-08-06', type: 'SOFR', percentRate: 3.65, volumeInBillions: 3055 },
      {
        effectiveDate: '2026-08-06',
        type: 'EFFR',
        percentRate: 3.63,
        targetRateFrom: 3.5,
        targetRateTo: 3.75,
      },
      { effectiveDate: '2026-08-06', type: 'UNKNOWN', percentRate: 1 },
    ],
  };

  const rates = parseReferenceRates(payload);
  // SOFRAI carries no percentRate and UNKNOWN has no label, so neither is a row.
  assert.deepEqual(rates.map((rate) => rate.type), ['EFFR', 'SOFR']);
  assert.equal(rates[0].targetRateTo, 3.75);
  assert.equal(rates[1].volumeInBillions, 3055);

  const averages = parseSofrAverages(payload);
  assert.equal(averages.average30day, 3.62347);
  assert.equal(averages.average90day, null);

  assert.throws(() => parseReferenceRates({}), /reference rates/);
});

test('EIA rows group by series into ascending observations', () => {
  const grouped = groupEiaRows({
    response: {
      data: [
        { period: '2026-08-03', series: 'RWTC', value: 66.2 },
        { period: '2026-07-27', series: 'RWTC', value: 65.1 },
        { period: '2026-08-03', series: 'RBRTE', value: '69.4' },
        { period: '2026-08-10', series: 'RWTC', value: null },
        { period: 'bad-date', series: 'RWTC', value: 1 },
      ],
    },
  });

  assert.deepEqual(
    grouped.get('RWTC').map((observation) => observation.date),
    ['2026-07-27', '2026-08-03'],
  );
  // String values are coerced; null and malformed periods are dropped.
  assert.equal(grouped.get('RBRTE')[0].value, 69.4);
  assert.equal(parseEiaPeriod('2026-13-01'), null);
  assert.throws(() => groupEiaRows({ response: {} }), /data rows/);
});

test('EIA comparisons only match observations inside the intended window', () => {
  const observations = [
    { date: '2025-08-04', value: 100 },
    { date: '2026-07-31', value: 110 },
    { date: '2026-08-07', value: 121 },
  ];

  const weekAgo = findComparison(observations, 7);
  assert.equal(weekAgo.date, '2026-07-31');
  assert.equal(Math.round(percentChange(observations.at(-1), weekAgo)), 10);

  const yearAgo = findComparison(observations, 365);
  assert.equal(yearAgo.date, '2025-08-04');

  // A series with only a distant prior point must not fake a week-ago change.
  assert.equal(
    findComparison(
      [
        { date: '2020-01-01', value: 1 },
        { date: '2026-08-07', value: 2 },
      ],
      7,
    ),
    null,
  );
  assert.equal(percentChange({ date: '2026-08-07', value: 5 }, null), null);
});

test('BEA display values survive thousands separators and suppression markers', () => {
  assert.equal(parseBeaValue('1,234.5'), 1234.5);
  assert.equal(parseBeaValue('(NA)'), null);
  assert.equal(parseBeaValue('(D)'), null);
  assert.equal(parseBeaValue(''), null);
  assert.equal(parseBeaValue(42), 42);
});

test('BEA state GDP reduces to the latest period with period-over-period growth', () => {
  const payload = {
    BEAAPI: {
      Results: {
        Data: [
          { GeoFips: '00000', GeoName: 'United States', TimePeriod: '2026Q1', DataValue: '9,999', CL_UNIT: 'Millions of chained 2017 dollars' },
          { GeoFips: '01000', GeoName: 'Alabama', TimePeriod: '2025Q1', DataValue: '200,000', CL_UNIT: 'Millions of chained 2017 dollars' },
          { GeoFips: '01000', GeoName: 'Alabama', TimePeriod: '2025Q2', DataValue: '202,000' },
          { GeoFips: '01000', GeoName: 'Alabama', TimePeriod: '2025Q3', DataValue: '204,000' },
          { GeoFips: '01000', GeoName: 'Alabama', TimePeriod: '2025Q4', DataValue: '206,000' },
          { GeoFips: '01000', GeoName: 'Alabama', TimePeriod: '2026Q1', DataValue: '210,000' },
          { GeoFips: '02000', GeoName: 'Alaska', TimePeriod: '2026Q1', DataValue: '(NA)' },
          { GeoFips: '98000', GeoName: 'Far West', TimePeriod: '2026Q1', DataValue: '4,000,000', CL_UNIT: 'Millions of chained 2017 dollars' },
        ],
      },
    },
  };

  const parsed = parseStateGdp(payload);
  assert.equal(parsed.period, '2026Q1');
  // The national aggregate, the BEA region, and the suppressed state are all
  // excluded, leaving only real states.
  assert.deepEqual(parsed.states.map((state) => state.name), ['Alabama']);

  const alabama = parsed.states[0];
  assert.equal(alabama.value, 210000);
  assert.equal(Number(alabama.changeOnQuarter.toFixed(3)), 1.942);
  assert.equal(Number(alabama.changeOnYear.toFixed(1)), 5);
  assert.match(parsed.unit, /chained/);

  assert.throws(() => parseStateGdp({}), /BEA data rows/);
});

test('Census timeseries reads columns by header name, not position', () => {
  const observations = parseCensusTimeseries([
    ['time_slot_id', 'cell_value', 'time'],
    ['1', '700,000', '2026-05'],
    ['1', '710000', '2026-06'],
    ['1', 'not-a-number', '2026-07'],
    ['1', '705000', 'bad-period'],
  ]);

  assert.deepEqual(observations, [
    { date: '2026-05-01', value: 700000 },
    { date: '2026-06-01', value: 710000 },
  ]);
  assert.equal(parseCensusPeriod('2026-13'), null);
  assert.throws(() => parseCensusTimeseries([['cell_value']]), /timeseries table/);
});

test('BEA region and aggregate FIPS codes are not treated as states', () => {
  assert.equal(isBeaStateFips('01000'), true);
  assert.equal(isBeaStateFips('11000'), true);
  // National total.
  assert.equal(isBeaStateFips('00000'), false);
  // The eight BEA regions share the 9x000 range.
  for (const region of ['91000', '92000', '95000', '98000']) {
    assert.equal(isBeaStateFips(region), false);
  }
});

test('Census keeps only national rows when a geography column is present', () => {
  // resconst and ressales repeat every period once per census region, so an
  // unfiltered parse would let a region stand in for the national figure.
  const observations = parseCensusTimeseries([
    ['cell_value', 'geo_level_code', 'time_slot_id', 'time'],
    ['248', 'MW', '0', '2026-06'],
    ['129', 'NO', '0', '2026-06'],
    ['741', 'SO', '0', '2026-06'],
    ['1427', 'US', '0', '2026-06'],
    ['309', 'WE', '0', '2026-06'],
    ['1199', 'US', '0', '2026-05'],
  ]);

  assert.deepEqual(observations, [
    { date: '2026-05-01', value: 1199 },
    { date: '2026-06-01', value: 1427 },
  ]);
});

test('Census indicator codes match the live EITS vocabulary', () => {
  // These pairs are easy to invert; the API answers an invalid pair with an
  // empty result set rather than an error, so they are pinned here.
  const byId = Object.fromEntries(
    CENSUS_INDICATORS.map((indicator) => [indicator.id, indicator]),
  );
  assert.equal(byId['retail-sales'].categoryCode, '44X72');
  assert.equal(byId['retail-sales'].dataTypeCode, 'SM');
  assert.equal(byId['housing-starts'].categoryCode, 'ASTARTS');
  assert.equal(byId['housing-starts'].dataTypeCode, 'TOTAL');
  assert.equal(byId['new-home-sales'].categoryCode, 'ASOLD');
  assert.equal(byId['new-home-sales'].dataTypeCode, 'TOTAL');
});

test('Census indicators compare against the same calendar month, not row offsets', () => {
  const definition = {
    id: 'retail-sales',
    dataset: 'marts',
    categoryCode: '44X72',
    dataTypeCode: 'SM',
    label: 'Advance retail and food services sales',
    unit: '$M',
    note: '',
  };
  // June is deliberately missing so a positional lookback would compare the
  // wrong month.
  const indicator = buildCensusIndicator(definition, [
    { date: '2025-07-01', value: 600000 },
    { date: '2026-05-01', value: 700000 },
    { date: '2026-07-01', value: 720000 },
  ]);

  assert.equal(indicator.latest.value, 720000);
  assert.equal(indicator.changeOnMonth, null);
  assert.equal(Number(indicator.changeOnYear.toFixed(0)), 20);
  assert.equal(buildCensusIndicator(definition, []), null);
});
