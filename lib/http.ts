export class RequestBodyError extends Error {
  readonly status: number;

  constructor(
    message: string,
    status: number,
  ) {
    super(message);
    this.name = 'RequestBodyError';
    this.status = status;
  }
}

/** Read and parse JSON without allowing an unbounded request body into memory. */
export async function readLimitedJson(
  request: Request,
  maxBytes: number,
): Promise<unknown> {
  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (!Number.isFinite(declaredBytes) || declaredBytes < 0) {
      throw new RequestBodyError('Invalid Content-Length header.', 400);
    }
    if (declaredBytes > maxBytes) {
      throw new RequestBodyError(`Request body exceeds ${maxBytes} bytes.`, 413);
    }
  }

  if (!request.body) {
    throw new RequestBodyError('Request body is required.', 400);
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let text = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    if (bytesRead > maxBytes) {
      await reader.cancel();
      throw new RequestBodyError(`Request body exceeds ${maxBytes} bytes.`, 413);
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new RequestBodyError('Invalid JSON body.', 400);
  }
}
