import { NextRequest } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
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
  const githubToken = process.env.GITHUB_TOKEN;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';

  const useAzure = Boolean(azureEndpoint && azureKey);

  if (!useAzure && !githubToken) {
    return new Response('AI chat is not configured. Add GITHUB_TOKEN to .env.local.', {
      status: 503,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  const messages = (body as { messages?: unknown }).messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response('Body must be { messages: ChatMessage[] }.', { status: 400 });
  }

  // Validate each message — only allow role/content string fields (no injection surface)
  for (const msg of messages) {
    if (
      typeof msg !== 'object' ||
      msg === null ||
      !['user', 'assistant'].includes((msg as Record<string, unknown>).role as string) ||
      typeof (msg as Record<string, unknown>).content !== 'string'
    ) {
      return new Response('Each message must have role ("user"|"assistant") and string content.', {
        status: 400,
      });
    }
    const content = (msg as Record<string, unknown>).content as string;
    if (content.length > 4000) {
      return new Response('Message content exceeds 4000 character limit.', { status: 400 });
    }
  }

  // Cap history depth to prevent prompt bloat
  const recentMessages = (messages as ChatMessage[]).slice(-20);

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
    temperature: 0.5,
    max_tokens: 1024,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      ...recentMessages,
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) controller.enqueue(encoder.encode(delta));
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.controller.abort();
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
