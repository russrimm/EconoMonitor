const FRED_PATHS = new Set([
  'series',
  'series/search',
  'series/observations',
  'category',
  'category/children',
  'category/series',
  'releases',
  'releases/dates',
]);

const FRASER_COLLECTIONS = new Set(['theme', 'timeline']);
const FRASER_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const FRED_SERIES_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const FRED_QUERY_KEYS: Record<string, Set<string>> = {
  series: new Set(['series_id']),
  'series/search': new Set([
    'search_text', 'offset', 'limit', 'order_by', 'sort_order',
  ]),
  'series/observations': new Set([
    'series_id', 'sort_order', 'limit', 'units', 'frequency',
    'aggregation_method', 'observation_start',
  ]),
  category: new Set(['category_id']),
  'category/children': new Set(['category_id']),
  'category/series': new Set([
    'category_id', 'offset', 'limit', 'order_by', 'sort_order',
  ]),
  releases: new Set(['offset', 'limit', 'order_by', 'sort_order']),
  'releases/dates': new Set([
    'limit', 'include_release_dates_with_no_data', 'sort_order',
  ]),
};

export function isAllowedFredPath(path: string): boolean {
  return FRED_PATHS.has(path);
}

export function isAllowedFraserPath(path: string): boolean {
  const segments = path.split('/');
  if (segments.length === 1) return FRASER_COLLECTIONS.has(segments[0]);
  if (segments.some((segment) => !FRASER_ID_RE.test(segment))) return false;

  const [collection, , child] = segments;
  if (collection === 'theme') {
    return segments.length === 2 || (segments.length === 3 && child === 'records');
  }
  if (collection === 'timeline') {
    return segments.length === 2 || (segments.length === 3 && child === 'events');
  }
  if (collection === 'title') {
    return segments.length === 2 || (segments.length === 3 && child === 'items');
  }
  return collection === 'item' && segments.length === 2;
}

export function fraserOperationName(path: string): string {
  return path
    .split('/')
    .map((segment, index) => (index === 1 ? ':id' : segment))
    .join('/');
}

export function hasAcceptableQueryLength(search: string, maxLength = 2_048): boolean {
  return search.length <= maxLength;
}

function isBoundedInteger(
  value: string | null,
  minimum: number,
  maximum: number,
): boolean {
  if (value === null || !/^\d+$/.test(value)) return false;
  const numeric = Number(value);
  return numeric >= minimum && numeric <= maximum;
}

export function validateFredQuery(
  path: string,
  params: URLSearchParams,
): string | null {
  const allowedKeys = FRED_QUERY_KEYS[path];
  if (!allowedKeys) return 'Unsupported FRED API path.';
  for (const key of params.keys()) {
    if (key === 'api_key') continue;
    if (!allowedKeys.has(key)) return `Unsupported FRED query parameter: ${key}.`;
    if (params.getAll(key).length > 1) return `Duplicate FRED query parameter: ${key}.`;
  }

  const seriesId = params.get('series_id');
  if (seriesId !== null && !FRED_SERIES_ID_RE.test(seriesId)) {
    return 'Invalid FRED series ID.';
  }
  const searchText = params.get('search_text');
  if (searchText !== null && (searchText.trim().length === 0 || searchText.length > 256)) {
    return 'Invalid FRED search text.';
  }
  for (const key of ['offset', 'category_id']) {
    const value = params.get(key);
    if (value !== null && !isBoundedInteger(value, 0, 1_000_000)) {
      return `Invalid FRED ${key}.`;
    }
  }
  const limit = params.get('limit');
  if (limit !== null && !isBoundedInteger(limit, 1, 100_000)) {
    return 'Invalid FRED limit.';
  }
  const observationStart = params.get('observation_start');
  if (observationStart !== null && !ISO_DATE_RE.test(observationStart)) {
    return 'Invalid FRED observation_start.';
  }
  const enums: [string, readonly string[]][] = [
    ['sort_order', ['asc', 'desc']],
    ['units', ['lin', 'chg', 'ch1', 'pch', 'pc1', 'pca', 'cch', 'cca', 'log']],
    ['frequency', ['d', 'w', 'bw', 'm', 'q', 'sa', 'a']],
    ['aggregation_method', ['avg', 'sum', 'eop']],
    ['include_release_dates_with_no_data', ['true', 'false']],
  ];
  for (const [key, values] of enums) {
    const value = params.get(key);
    if (value !== null && !values.includes(value)) return `Invalid FRED ${key}.`;
  }
  if (params.has('aggregation_method') && !params.has('frequency')) {
    return 'FRED aggregation_method requires frequency.';
  }
  return null;
}

export function validateFraserQuery(params: URLSearchParams): string | null {
  for (const key of params.keys()) {
    if (key === 'api_key') continue;
    if (!['limit', 'page'].includes(key)) {
      return `Unsupported FRASER query parameter: ${key}.`;
    }
    if (params.getAll(key).length > 1) {
      return `Duplicate FRASER query parameter: ${key}.`;
    }
  }
  const limit = params.get('limit');
  if (limit !== null && !isBoundedInteger(limit, 1, 200)) {
    return 'Invalid FRASER limit.';
  }
  const page = params.get('page');
  if (page !== null && !isBoundedInteger(page, 1, 10_000)) {
    return 'Invalid FRASER page.';
  }
  return null;
}
