export function withDeadline(
  signal: AbortSignal | undefined,
  timeoutMs: number,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  return signal ? AbortSignal.any([signal, timeout]) : timeout;
}

function assertDeclaredSize(response: Response, maximumBytes: number): void {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new Error('response exceeded size limit');
  }
}

export async function* readBoundedResponseChunks(
  response: Response,
  maximumBytes: number,
): AsyncGenerator<Uint8Array> {
  if (!response.body) {
    assertDeclaredSize(response, maximumBytes);
    return;
  }

  const reader = response.body.getReader();
  let bytes = 0;
  let completed = false;
  try {
    assertDeclaredSize(response, maximumBytes);
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        completed = true;
        break;
      }
      bytes += value.byteLength;
      if (bytes > maximumBytes) {
        throw new Error('response exceeded size limit');
      }
      yield value;
    }
  } finally {
    if (!completed) {
      try {
        await reader.cancel();
      } finally {
        reader.releaseLock();
      }
    } else {
      reader.releaseLock();
    }
  }
}

export async function readBoundedResponseText(
  response: Response,
  maximumBytes: number,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for await (const chunk of readBoundedResponseChunks(response, maximumBytes)) {
    chunks.push(chunk);
    bytes += chunk.byteLength;
  }

  const body = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export async function readBoundedResponseJson(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('json')) {
    throw new Error('response was not JSON');
  }
  const text = await readBoundedResponseText(response, maximumBytes);
  return JSON.parse(text) as unknown;
}
