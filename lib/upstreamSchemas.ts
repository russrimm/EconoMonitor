function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return (
      ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

function isFredSeries(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.frequency === 'string' &&
    typeof value.frequency_short === 'string' &&
    typeof value.units === 'string' &&
    typeof value.units_short === 'string' &&
    typeof value.seasonal_adjustment === 'string' &&
    typeof value.seasonal_adjustment_short === 'string' &&
    isIsoDate(value.observation_start) &&
    isIsoDate(value.observation_end) &&
    typeof value.last_updated === 'string' &&
    typeof value.popularity === 'number' &&
    Number.isFinite(value.popularity) &&
    (value.notes === undefined || typeof value.notes === 'string')
  );
}

function isFredObservation(value: unknown): boolean {
  if (!isRecord(value) || !isIsoDate(value.date) || typeof value.value !== 'string') {
    return false;
  }
  if (value.value === '.') return true;
  const numeric = Number(value.value);
  return value.value.trim() !== '' && Number.isFinite(numeric);
}

function isFredCategory(value: unknown): boolean {
  return (
    isRecord(value) &&
    isInteger(value.id) &&
    typeof value.name === 'string' &&
    isInteger(value.parent_id)
  );
}

function isFredRelease(value: unknown): boolean {
  return (
    isRecord(value) &&
    isInteger(value.id) &&
    typeof value.name === 'string' &&
    typeof value.press_release === 'boolean' &&
    (value.link === undefined || isHttpUrl(value.link))
  );
}

function isFredReleaseDate(value: unknown): boolean {
  return (
    isRecord(value) &&
    isInteger(value.release_id) &&
    typeof value.release_name === 'string' &&
    isIsoDate(value.date)
  );
}

function hasArray(
  payload: unknown,
  key: string,
  validator: (value: unknown) => boolean,
): payload is Record<string, unknown> {
  return (
    isRecord(payload) &&
    Array.isArray(payload[key]) &&
    (payload[key] as unknown[]).every(validator)
  );
}

function hasPagination(payload: Record<string, unknown>): boolean {
  return (
    isInteger(payload.count) &&
    isInteger(payload.offset) &&
    isInteger(payload.limit)
  );
}

export function validateFredPayload(path: string, payload: unknown): boolean {
  switch (path) {
    case 'series':
      return hasArray(payload, 'seriess', isFredSeries);
    case 'series/search':
    case 'category/series':
      return (
        hasArray(payload, 'seriess', isFredSeries) &&
        hasPagination(payload)
      );
    case 'series/observations':
      return (
        hasArray(payload, 'observations', isFredObservation) &&
        isInteger(payload.count)
      );
    case 'category':
    case 'category/children':
      return hasArray(payload, 'categories', isFredCategory);
    case 'releases':
      return (
        hasArray(payload, 'releases', isFredRelease) &&
        hasPagination(payload)
      );
    case 'releases/dates':
      return hasArray(payload, 'release_dates', isFredReleaseDate);
    default:
      return false;
  }
}

function isStringOrNumber(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number';
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string';
}

function isFraserDate(value: unknown): value is string {
  if (typeof value !== 'string' || value.trim() === '') return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return isIsoDate(value);
  return !Number.isNaN(new Date(value).getTime());
}

function isIdentifierInfo(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.recordIdentifier) &&
    value.recordIdentifier.length > 0 &&
    value.recordIdentifier.every(isStringOrNumber)
  );
}

function isFraserRecordInfo(value: unknown): boolean {
  return (
    isRecord(value) &&
    Array.isArray(value.recordIdentifier) &&
    value.recordIdentifier.length > 0 &&
    value.recordIdentifier.every(isStringOrNumber) &&
    typeof value.recordType === 'string'
  );
}

function isTitleInfo(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => isRecord(entry) && typeof entry.title === 'string')
  );
}

function isUrlArray(value: unknown): boolean {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.every((entry) =>
        isHttpUrl(entry) ||
        (isRecord(entry) && isHttpUrl(entry.$))
      ))
  );
}

function isFraserLocation(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      isUrlArray(value.url) &&
      isUrlArray(value.apiUrl) &&
      isUrlArray(value.pdfUrl) &&
      isUrlArray(value.textUrl))
  );
}

function isFraserOriginInfo(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      isOptionalString(value.issuance) &&
      isOptionalString(value.frequency) &&
      (value.sortDate === undefined || isFraserDate(value.sortDate)) &&
      (value.dateIssued === undefined ||
        (Array.isArray(value.dateIssued) &&
          value.dateIssued.every(
            (entry) =>
              isFraserDate(entry) ||
              (isRecord(entry) && isFraserDate(entry.$)),
          ))))
  );
}

function isFraserSubject(value: unknown): boolean {
  return (
    value === undefined ||
    (isRecord(value) &&
      (value.topic === undefined ||
        (Array.isArray(value.topic) &&
          value.topic.every(
            (entry) =>
              isRecord(entry) &&
              typeof entry.topic === 'string' &&
              isIdentifierInfo(entry.recordInfo),
          ))))
  );
}

function isFraserName(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.role === 'string' &&
    Array.isArray(value.namePart) &&
    value.namePart.every(
      (part) =>
        typeof part === 'string' ||
        (isRecord(part) && typeof part.$ === 'string'),
    )
  );
}

function isFraserRecord(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFraserRecordInfo(value.recordInfo) &&
    (value.titleInfo === undefined || isTitleInfo(value.titleInfo)) &&
    isFraserLocation(value.location) &&
    isFraserOriginInfo(value.originInfo) &&
    (value.abstract === undefined || isStringArray(value.abstract)) &&
    (value.genre === undefined || isStringArray(value.genre)) &&
    (value.name === undefined ||
      (Array.isArray(value.name) && value.name.every(isFraserName))) &&
    isFraserSubject(value.subject)
  );
}

function isFraserTheme(value: unknown): boolean {
  return (
    isRecord(value) &&
    isTitleInfo(value.titleInfo) &&
    isFraserRecordInfo(value.recordInfo) &&
    isFraserLocation(value.location) &&
    (value.abstract === undefined || isStringArray(value.abstract)) &&
    isFraserSubject(value.subject)
  );
}

function isFraserTimeline(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    isHttpUrl(value.url) &&
    typeof value.title === 'string' &&
    isOptionalString(value.description) &&
    isOptionalString(value.abstract) &&
    isOptionalString(value.created) &&
    isOptionalString(value.modified)
  );
}

function isFraserTimelineEvent(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !isFraserLocation(value.location) ||
    !isFraserOriginInfo(value.originInfo) ||
    (value.titleInfo !== undefined && !isTitleInfo(value.titleInfo)) ||
    (value.abstract !== undefined && !isStringArray(value.abstract)) ||
    (value.note !== undefined && !isStringArray(value.note)) ||
    (value.recordInfo !== undefined && !isFraserRecordInfo(value.recordInfo)) ||
    !isOptionalString(value.title) ||
    (value.date !== undefined && !isFraserDate(value.date)) ||
    !isOptionalString(value.description)
  ) {
    return false;
  }
  const hasTitle =
    typeof value.title === 'string' ||
    value.titleInfo !== undefined;
  const hasDate =
    typeof value.date === 'string' ||
    (isRecord(value.originInfo) &&
      (typeof value.originInfo.sortDate === 'string' ||
        Array.isArray(value.originInfo.dateIssued)));
  return hasTitle && hasDate;
}

function isFraserEnvelope(
  payload: unknown,
  validator: (value: unknown) => boolean,
): boolean {
  return (
    isRecord(payload) &&
    typeof payload.format === 'string' &&
    isInteger(payload.page) &&
    isInteger(payload.limit) &&
    isInteger(payload.total) &&
    isInteger(payload.start) &&
    Array.isArray(payload.records) &&
    payload.records.every(validator)
  );
}

export function validateFraserPayload(path: string, payload: unknown): boolean {
  const segments = path.split('/');
  if (segments[0] === 'theme') {
    return isFraserEnvelope(
      payload,
      segments.length === 1 || segments.length === 2
        ? isFraserTheme
        : isFraserRecord,
    );
  }
  if (segments[0] === 'timeline') {
    return isFraserEnvelope(
      payload,
      segments[2] === 'events' ? isFraserTimelineEvent : isFraserTimeline,
    );
  }
  if (segments[0] === 'title' || segments[0] === 'item') {
    return isFraserEnvelope(payload, isFraserRecord);
  }
  return false;
}
