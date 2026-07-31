import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai';
import { validateAnalyzeDatasets } from '@/lib/aiValidation';
import { readLimitedJson, RequestBodyError } from '@/lib/http';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 256 * 1024;
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function textResponse(message: string, status: number) {
  return new Response(message, { status, headers: RESPONSE_HEADERS });
}

export async function POST(req: NextRequest) {
  const githubToken = process.env.GITHUB_TOKEN;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';

  const useAzure = Boolean(azureEndpoint && azureKey);

  if (!useAzure && !githubToken) {
    return textResponse(
      'AI analysis is not configured. Set GITHUB_TOKEN (or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY) in your environment variables.',
      503,
    );
  }

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

  const client = useAzure
    ? new OpenAI({
        baseURL: `${azureEndpoint}/openai/deployments/${azureDeployment}`,
        apiKey: azureKey!,
        defaultQuery: { 'api-version': '2024-02-01' },
        defaultHeaders: { 'api-key': azureKey! },
      })
    : new OpenAI({
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: githubToken!,
      });

  const model = useAzure ? azureDeployment : 'gpt-4o';

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
      { signal: req.signal },
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
