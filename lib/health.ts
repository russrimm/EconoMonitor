type Environment = Record<string, string | undefined>;

export interface ReadinessBody {
  status: 'ready' | 'degraded' | 'not_ready';
  checks: {
    fred: { required: true; configured: boolean };
    fraser: { required: false; configured: boolean };
    ai: { required: false; configured: boolean };
  };
}

function isConfigured(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export function getReadiness(env: Environment): {
  httpStatus: 200 | 503;
  body: ReadinessBody;
} {
  const fredConfigured = isConfigured(env.FRED_API_KEY);
  const fraserConfigured = isConfigured(env.FRASER_API_KEY);
  // GitHub Models was retired on 2026-07-30; Azure OpenAI is the only provider.
  // The endpoint alone is sufficient because Azure authenticates with managed
  // identity — an API key is optional and only used for local development.
  const aiConfigured = isConfigured(env.AZURE_OPENAI_ENDPOINT);

  const status = !fredConfigured
    ? 'not_ready'
    : fraserConfigured && aiConfigured
      ? 'ready'
      : 'degraded';

  return {
    httpStatus: fredConfigured ? 200 : 503,
    body: {
      status,
      checks: {
        fred: { required: true, configured: fredConfigured },
        fraser: { required: false, configured: fraserConfigured },
        ai: { required: false, configured: aiConfigured },
      },
    },
  };
}
