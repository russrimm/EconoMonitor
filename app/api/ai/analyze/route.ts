import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/ai';
import type { AnalyzeDataset } from '@/lib/ai';

export const runtime = 'nodejs';

// Allowlist pattern for series IDs — prevents injection via the seriesId field
const SERIES_ID_RE = /^[A-Z0-9_\-]{1,30}$/;

export async function POST(req: NextRequest) {
  const githubToken = process.env.GITHUB_TOKEN;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';

  const useAzure = Boolean(azureEndpoint && azureKey);

  if (!useAzure && !githubToken) {
    return new Response(
      'AI analysis is not configured. Set GITHUB_TOKEN (or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY) in your environment variables.',
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).datasets)) {
    return new Response('Body must be { datasets: AnalyzeDataset[] }.', { status: 400 });
  }

  const datasets = (body as { datasets: unknown[] }).datasets as AnalyzeDataset[];

  if (datasets.length === 0 || datasets.length > 6) {
    return new Response('Provide between 1 and 6 datasets.', { status: 400 });
  }

  for (const ds of datasets) {
    if (typeof ds.seriesId !== 'string' || !SERIES_ID_RE.test(ds.seriesId)) {
      return new Response(
        'Each dataset must have a valid seriesId (uppercase letters, digits, underscores, hyphens; max 30 chars).',
        { status: 400 },
      );
    }
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

  const stream = await client.chat.completions.create({
    model,
    stream: true,
    temperature: 0.3,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: buildUserPrompt(datasets) },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) controller.enqueue(encoder.encode(text));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
