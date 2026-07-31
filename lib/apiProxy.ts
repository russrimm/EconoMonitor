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

export function hasAcceptableQueryLength(search: string, maxLength = 2_048): boolean {
  return search.length <= maxLength;
}
