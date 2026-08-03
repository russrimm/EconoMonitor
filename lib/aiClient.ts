import { AzureOpenAI } from 'openai';
import {
  DefaultAzureCredential,
  getBearerTokenProvider,
  type TokenCredential,
} from '@azure/identity';

/**
 * GitHub Models (https://models.inference.ai.azure.com) was fully retired on
 * 2026-07-30, so Azure OpenAI is now the only supported provider.
 *
 * Managed identity is preferred and is what runs in Azure; the API key path
 * exists only for local development against a resource that still allows local
 * auth. Hardened resources set `disableLocalAuth`, which rejects keys outright.
 */

const AZURE_COGNITIVE_SCOPE = 'https://cognitiveservices.azure.com/.default';
const API_VERSION = '2024-10-21';
const DEFAULT_DEPLOYMENT = 'gpt-4o';

export const AI_NOT_CONFIGURED_MESSAGE =
  'AI features are not configured. Set AZURE_OPENAI_ENDPOINT (and AZURE_OPENAI_DEPLOYMENT) ' +
  'in your environment. Azure deployments authenticate with managed identity; for local ' +
  'development add AZURE_OPENAI_API_KEY or sign in with the Azure CLI.';

export interface AiConfig {
  endpoint: string;
  deployment: string;
  apiKey?: string;
}

type Environment = Record<string, string | undefined>;

function trimmed(value: string | undefined): string | undefined {
  const next = value?.trim();
  return next ? next : undefined;
}

export function readAiConfig(env: Environment = process.env): AiConfig | null {
  const endpoint = trimmed(env.AZURE_OPENAI_ENDPOINT)?.replace(/\/+$/, '');
  if (!endpoint) return null;

  return {
    endpoint,
    deployment: trimmed(env.AZURE_OPENAI_DEPLOYMENT) ?? DEFAULT_DEPLOYMENT,
    apiKey: trimmed(env.AZURE_OPENAI_API_KEY),
  };
}

export function isAiConfigured(env: Environment = process.env): boolean {
  return readAiConfig(env) !== null;
}

// DefaultAzureCredential caches tokens internally, so it must outlive a single
// request. Building one per request would re-fetch a token on every call.
let credential: TokenCredential | undefined;

function getCredential(): TokenCredential {
  credential ??= new DefaultAzureCredential();
  return credential;
}

let cachedClient: { key: string; client: AzureOpenAI } | undefined;

export function getAiClient(config: AiConfig): AzureOpenAI {
  const key = `${config.endpoint}|${config.deployment}|${config.apiKey ? 'key' : 'identity'}`;
  if (cachedClient?.key === key) return cachedClient.client;

  const client = config.apiKey
    ? new AzureOpenAI({
        endpoint: config.endpoint,
        deployment: config.deployment,
        apiVersion: API_VERSION,
        apiKey: config.apiKey,
      })
    : new AzureOpenAI({
        endpoint: config.endpoint,
        deployment: config.deployment,
        apiVersion: API_VERSION,
        azureADTokenProvider: getBearerTokenProvider(
          getCredential(),
          AZURE_COGNITIVE_SCOPE,
        ),
      });

  cachedClient = { key, client };
  return client;
}

/** Returns the client and the model name to send, or null when unconfigured. */
export function resolveAiClient(
  env: Environment = process.env,
): { client: AzureOpenAI; model: string } | null {
  const config = readAiConfig(env);
  if (!config) return null;
  return { client: getAiClient(config), model: config.deployment };
}
