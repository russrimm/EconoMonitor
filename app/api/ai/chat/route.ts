import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { validateChatMessages } from '@/lib/aiValidation';
import { readLimitedJson, RequestBodyError } from '@/lib/http';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 96 * 1024;
const PROVIDER_TIMEOUT_MS = 60_000;
const RESPONSE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function textResponse(message: string, status: number) {
  return new Response(message, { status, headers: RESPONSE_HEADERS });
}

const SYSTEM_PROMPT = `You are EconoMonitor AI — a knowledgeable economic research assistant specialising in macroeconomics, financial markets, monetary policy, and economic data.

You help users understand economic indicators, interpret trends, and explore relationships between data series such as GDP, unemployment, inflation (CPI/PCE), interest rates, housing, trade, and more.

Guidelines:
- Be concise but thorough. Use plain language; avoid unnecessary jargon.
- When citing statistics or data, acknowledge that figures may change and users should confirm against the latest release.
- You do not have real-time data access — encourage users to use the dashboard's Search and Compare tools for live figures.
- If asked about a specific FRED series (e.g. UNRATE, CPIAUCSL), explain what it measures and how to interpret it.
- Format responses with light markdown (bullet points, bold for key terms) for readability.
- Keep responses focused on economics, finance, and related policy topics.`;

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

  const validation = validateChatMessages(body);
  if (!validation.ok) return textResponse(validation.error, 400);

  const githubToken = process.env.GITHUB_TOKEN;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';
  const useAzure = Boolean(azureEndpoint && azureKey);
  if (!useAzure && !githubToken) {
    return textResponse('AI chat is not configured. Add GITHUB_TOKEN to .env.local.', 503);
  }

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
  const providerSignal = AbortSignal.any([
    req.signal,
    AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  ]);

  const createStream = () =>
    client.chat.completions.create(
      {
        model,
        stream: true,
        temperature: 0.5,
        max_tokens: 1024,
        messages: [
          { role: 'system' as const, content: SYSTEM_PROMPT },
          ...validation.value,
        ],
      },
      { signal: providerSignal },
    );
  let stream: Awaited<ReturnType<typeof createStream>>;
  try {
    stream = await createStream();
  } catch (error) {
    console.error('[AI chat] provider request failed:', error);
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
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
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
