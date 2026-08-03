import { NextRequest } from 'next/server';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai';
import { AI_NOT_CONFIGURED_MESSAGE, resolveAiClient } from '@/lib/aiClient';
import { validateAnalyzeDatasets } from '@/lib/aiValidation';
import { readLimitedJson, RequestBodyError } from '@/lib/http';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 256 * 1024;
const PROVIDER_TIMEOUT_MS = 60_000;
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function textResponse(message: string, status: number) {
  return new Response(message, { status, headers: RESPONSE_HEADERS });
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await readLimitedJson(req, MAX_BODY_BYTES);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return textResponse(error.message, error.status);
    }
    throw error;
  }

  const validation = validateAnalyzeDatasets(body);
  if (!validation.ok) return textResponse(validation.error, 400);
  const datasets = validation.value;

  const resolved = resolveAiClient();
  if (!resolved) {
    return textResponse(AI_NOT_CONFIGURED_MESSAGE, 503);
  }
  const { client, model } = resolved;

  const providerSignal = AbortSignal.any([
    req.signal,
    AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  ]);

  const createStream = () =>
    client.chat.completions.create(
      {
        model,
        stream: true,
        temperature: 0.3,
        max_tokens: 2048,
        messages: [
          { role: 'system' as const, content: buildSystemPrompt() },
          { role: 'user' as const, content: buildUserPrompt(datasets) },
        ],
      },
      { signal: providerSignal },
    );
  let stream: Awaited<ReturnType<typeof createStream>>;
  try {
    stream = await createStream();
  } catch (error) {
    console.error('[AI analyze] provider request failed:', error);
    const status = (error as { status?: number }).status === 429 ? 429 : 502;
    return textResponse(
      status === 429
        ? 'AI provider rate limit reached. Try again shortly.'
        : 'AI provider request failed. Try again later.',
      status,
    );
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      ...RESPONSE_HEADERS,
    },
  });
}
