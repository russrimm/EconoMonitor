export type UpstreamOutcome =
  | 'success'
  | 'http_error'
  | 'invalid_payload'
  | 'timeout'
  | 'aborted'
  | 'network_error';

interface UpstreamContext {
  service: 'fred' | 'fraser' | 'gdelt' | 'federal_reserve';
  operation: string;
  timeoutMs: number;
  cachePolicy: 'no-store' | `revalidate-${number}`;
}

interface UpstreamEvent extends UpstreamContext {
  outcome: UpstreamOutcome;
  durationMs: number;
  status?: number;
  cacheOutcome: 'bypass' | 'shared-hit' | 'miss-or-revalidated' | 'not-cacheable';
}

interface PendingUpstreamEvent {
  context: UpstreamContext;
  startedAt: number;
  callerSignal?: AbortSignal;
  timeoutSignal: AbortSignal;
  recorded: boolean;
}

const pendingEvents = new WeakMap<Response, PendingUpstreamEvent>();

function writeEvent(event: UpstreamEvent): void {
  console.info(JSON.stringify({
    event: 'upstream_request',
    ...event,
  }));
}

function cacheOutcome(
  response: Response,
  context: UpstreamContext,
): UpstreamEvent['cacheOutcome'] {
  if (!response.ok) return 'not-cacheable';
  if (context.cachePolicy === 'no-store') return 'bypass';
  const age = Number(response.headers.get('age'));
  return Number.isFinite(age) && age > 0 ? 'shared-hit' : 'miss-or-revalidated';
}

function completeEvent(response: Response, outcome: UpstreamOutcome): void {
  const pending = pendingEvents.get(response);
  if (!pending || pending.recorded) return;
  pending.recorded = true;
  writeEvent({
    ...pending.context,
    outcome,
    status: response.status,
    durationMs: Math.round(performance.now() - pending.startedAt),
    cacheOutcome: cacheOutcome(response, pending.context),
  });
}

function payloadFailureOutcome(response: Response): UpstreamOutcome {
  const pending = pendingEvents.get(response);
  if (pending?.callerSignal?.aborted) return 'aborted';
  if (pending?.timeoutSignal.aborted) return 'timeout';
  return 'invalid_payload';
}

export async function fetchUpstream(
  input: string | URL,
  init: RequestInit & { next?: { revalidate: number } },
  context: UpstreamContext,
): Promise<Response> {
  const startedAt = performance.now();
  const callerSignal = init.signal ?? undefined;
  const timeoutSignal = AbortSignal.timeout(context.timeoutMs);
  const signal = callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal;

  try {
    const response = await fetch(input, { ...init, signal });
    pendingEvents.set(response, {
      context,
      startedAt,
      callerSignal,
      timeoutSignal,
      recorded: false,
    });
    if (!response.ok) completeEvent(response, 'http_error');
    return response;
  } catch (error) {
    const outcome: UpstreamOutcome = callerSignal?.aborted
      ? 'aborted'
      : timeoutSignal.aborted
        ? 'timeout'
        : 'network_error';
    writeEvent({
      ...context,
      outcome,
      durationMs: Math.round(performance.now() - startedAt),
      cacheOutcome: 'not-cacheable',
    });
    throw error;
  }
}

export function logUpstreamSuccess(response: Response): void {
  completeEvent(response, 'success');
}

export function logInvalidPayload(response: Response): void {
  completeEvent(response, payloadFailureOutcome(response));
}

export async function readLimitedText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  try {
    const declaredLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
      throw new Error('upstream response exceeded size limit');
    }
    if (!response.body) return '';

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        await reader.cancel();
        throw new Error('upstream response exceeded size limit');
      }
      chunks.push(value);
    }

    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(body);
  } catch (error) {
    logInvalidPayload(response);
    throw error;
  }
}

export async function readLimitedJson(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('json')) {
      throw new Error('upstream response was not JSON');
    }
    const text = await readLimitedText(response, maximumBytes);
    return JSON.parse(text) as unknown;
  } catch (error) {
    logInvalidPayload(response);
    throw error;
  }
}
