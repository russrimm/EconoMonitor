import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { EVENTS, fraserSearchUrl, type HistoricalEvent } from '@/lib/events';

export const runtime = 'nodejs';

const SERIES_ID_RE = /^[A-Z0-9_\-]{1,30}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TWO_YEARS_MS = 1000 * 60 * 60 * 24 * 365 * 2;

interface Observation {
  date: string;
  value: string;
}

interface ExplainBody {
  seriesId: string;
  label: string;
  units: string;
  /** ISO date the user wants explained — typically a notable spike/drop. */
  focusDate: string;
  /** ~24 surrounding observations (downsampled by the client). */
  observations: Observation[];
}

function eventsNearby(focusDate: string): HistoricalEvent[] {
  const t0 = new Date(focusDate + 'T00:00:00').getTime();
  return EVENTS.filter((e) => {
    const start = new Date(e.date + 'T00:00:00').getTime();
    const end = e.endDate
      ? new Date(e.endDate + 'T00:00:00').getTime()
      : start;
    // Event window expanded by ±2 years to allow context, then check overlap.
    return Math.abs(start - t0) <= TWO_YEARS_MS || Math.abs(end - t0) <= TWO_YEARS_MS;
  });
}

function buildPrompt(body: ExplainBody, candidates: HistoricalEvent[]): string {
  const lines: string[] = [];
  lines.push(`## Causal explanation request`);
  lines.push(`Series: **${body.seriesId}** — ${body.label}`);
  lines.push(`Units: ${body.units}`);
  lines.push(`Focus date: ${body.focusDate}`);
  lines.push('');
  lines.push(`### Surrounding observations`);
  lines.push(`Date,Value`);
  for (const o of body.observations) {
    lines.push(`${o.date},${o.value}`);
  }
  lines.push('');
  lines.push(`### Candidate historical events (within ±2 years of the focus date)`);
  if (candidates.length === 0) {
    lines.push(`(none in the curated registry — rely on general macro knowledge.)`);
  } else {
    for (const e of candidates) {
      const dateLabel = e.endDate ? `${e.date} → ${e.endDate}` : e.date;
      lines.push(`- [${e.id}] ${e.title} (${e.category}, ${dateLabel}) — ${e.summary}`);
      lines.push(`  FRASER: ${fraserSearchUrl(e)}`);
    }
  }
  lines.push('');
  lines.push(
    `### Task\n` +
      `Explain in 4-7 sentences why ${body.seriesId} moved as it did around ${body.focusDate}. ` +
      `Be specific about the macro/policy/market mechanism. Cite the most relevant candidate ` +
      `events using the format **[event-id]** inline (e.g. [lehman]). Only cite events that are ` +
      `genuinely relevant — do not name-drop. If no listed event explains the move, say so and ` +
      `propose a plausible alternative driver.`,
  );
  return lines.join('\n');
}

function buildSystemPrompt(): string {
  return (
    `You are a senior macroeconomic analyst. You explain why specific economic indicators ` +
    `moved on specific dates by linking the move to monetary policy actions, fiscal events, ` +
    `oil/commodity shocks, financial crises, and other contemporaneous developments. ` +
    `Be precise and avoid generic statements. Always cite candidate events when relevant ` +
    `using **[event-id]** notation.`
  );
}

export async function POST(req: NextRequest) {
  const githubToken = process.env.GITHUB_TOKEN;
  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;
  const azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4o';
  const useAzure = Boolean(azureEndpoint && azureKey);

  if (!useAzure && !githubToken) {
    return new Response(
      'AI explanation is not configured. Set GITHUB_TOKEN (or AZURE_OPENAI_ENDPOINT + AZURE_OPENAI_API_KEY) in your environment variables.',
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON body.', { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return new Response('Body must be an object.', { status: 400 });
  }
  const b = body as Partial<ExplainBody>;

  if (typeof b.seriesId !== 'string' || !SERIES_ID_RE.test(b.seriesId)) {
    return new Response('Invalid seriesId.', { status: 400 });
  }
  if (typeof b.label !== 'string' || b.label.length > 200) {
    return new Response('Invalid label.', { status: 400 });
  }
  if (typeof b.units !== 'string' || b.units.length > 100) {
    return new Response('Invalid units.', { status: 400 });
  }
  if (typeof b.focusDate !== 'string' || !ISO_DATE_RE.test(b.focusDate)) {
    return new Response('focusDate must be a YYYY-MM-DD string.', { status: 400 });
  }
  if (
    !Array.isArray(b.observations) ||
    b.observations.length === 0 ||
    b.observations.length > 60
  ) {
    return new Response('observations must be a 1–60 element array.', { status: 400 });
  }
  for (const o of b.observations) {
    if (
      !o ||
      typeof o.date !== 'string' ||
      !ISO_DATE_RE.test(o.date) ||
      typeof o.value !== 'string' ||
      o.value.length > 32
    ) {
      return new Response('observations must be { date, value } with ISO dates.', { status: 400 });
    }
  }

  const safeBody: ExplainBody = {
    seriesId: b.seriesId,
    label: b.label,
    units: b.units,
    focusDate: b.focusDate,
    observations: b.observations,
  };

  const candidates = eventsNearby(safeBody.focusDate);

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
    max_tokens: 800,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user',   content: buildPrompt(safeBody, candidates) },
    ],
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Send the candidate events first, as a JSON header line, so the client
        // can render FRASER deep-links alongside the streamed prose.
        const header = JSON.stringify({
          __meta: 'candidates',
          candidates: candidates.map((e) => ({
            id: e.id,
            title: e.title,
            date: e.date,
            endDate: e.endDate ?? null,
            category: e.category,
            summary: e.summary,
            fraserUrl: fraserSearchUrl(e),
          })),
        });
        controller.enqueue(encoder.encode(header + '\n'));

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
