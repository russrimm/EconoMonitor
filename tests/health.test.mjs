import assert from 'node:assert/strict';
import test from 'node:test';

import { getReadiness } from '../lib/health.ts';

test('readiness reports capability state without serializing configuration values', () => {
  const unavailable = getReadiness({});
  assert.equal(unavailable.httpStatus, 503);
  assert.equal(unavailable.body.status, 'not_ready');

  const degraded = getReadiness({ FRED_API_KEY: 'fred-sensitive-value' });
  assert.equal(degraded.httpStatus, 200);
  assert.equal(degraded.body.status, 'degraded');

  const ready = getReadiness({
    FRED_API_KEY: 'fred-sensitive-value',
    FRASER_API_KEY: 'fraser-sensitive-value',
    AZURE_OPENAI_ENDPOINT: 'https://example.openai.azure.com',
    AZURE_OPENAI_API_KEY: 'ai-sensitive-value',
  });
  assert.equal(ready.httpStatus, 200);
  assert.equal(ready.body.status, 'ready');
  const serialized = JSON.stringify(ready.body);
  assert.doesNotMatch(serialized, /sensitive-value|openai\.azure\.com/);
});

test('readiness treats AI as configured when only an endpoint is set', () => {
  // Azure authenticates with managed identity, so there is no API key in
  // production. Requiring one would report a healthy deployment as degraded.
  const ready = getReadiness({
    FRED_API_KEY: 'fred-sensitive-value',
    FRASER_API_KEY: 'fraser-sensitive-value',
    AZURE_OPENAI_ENDPOINT: 'https://example.cognitiveservices.azure.com',
  });
  assert.equal(ready.body.status, 'ready');
  assert.equal(ready.body.checks.ai.configured, true);
});

test('readiness no longer treats a GitHub Models token as AI configuration', () => {
  // GitHub Models was retired on 2026-07-30; a lingering token is not a provider.
  const degraded = getReadiness({
    FRED_API_KEY: 'fred-sensitive-value',
    FRASER_API_KEY: 'fraser-sensitive-value',
    GITHUB_TOKEN: 'github_pat_retired',
  });
  assert.equal(degraded.body.status, 'degraded');
  assert.equal(degraded.body.checks.ai.configured, false);
});
