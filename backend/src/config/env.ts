import { z } from 'zod';
import type { Env } from '../types';

const envSchema = z.object({
  ISSUER_ENDPOINT: z.string().min(1, '环境变量 ISSUER_ENDPOINT 未配置或为空'),
  WORKER_RESOURCE_INDICATOR: z.string().min(1, '环境变量 WORKER_RESOURCE_INDICATOR 未配置或为空'),
  DEBUG: z.string().optional(),
  NEXUS_ENGINE_URL: z.string().optional(),
  NEXUS_ENGINE_ADMIN_SECRET: z.string().optional(),
  NEXUS_ENGINE_JWT_SECRET: z.string().optional(),
  LLM_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_BASE: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  WORKER_URL: z.string().optional(),
  CORS_ALLOW_ORIGINS: z.string().optional(),
});

export interface ParsedConfig {
  issuerEndpoint: string;
  resourceIndicator: string;
  debug: boolean;
  nexusEngineUrl?: string;
  nexusEngineAdminSecret?: string;
  nexusEngineJwtSecret?: string;
  llmWebhookSecret?: string;
  openaiApiBase?: string;
  openaiApiKey?: string;
  workerUrls: string[];
  corsAllowOrigins: string[];
}

export function parseConfig(env: Env): ParsedConfig {
  const parsed = envSchema.parse(env);

  return {
    issuerEndpoint: parsed.ISSUER_ENDPOINT,
    resourceIndicator: parsed.WORKER_RESOURCE_INDICATOR,
    debug: parsed.DEBUG === 'true' || parsed.DEBUG === '1',
    nexusEngineUrl: parsed.NEXUS_ENGINE_URL || undefined,
    nexusEngineAdminSecret: parsed.NEXUS_ENGINE_ADMIN_SECRET || undefined,
    nexusEngineJwtSecret: parsed.NEXUS_ENGINE_JWT_SECRET || undefined,
    llmWebhookSecret: parsed.LLM_WEBHOOK_SECRET || undefined,
    openaiApiBase: parsed.OPENAI_API_BASE || undefined,
    openaiApiKey: parsed.OPENAI_API_KEY || undefined,
    workerUrls: parsed.WORKER_URL
      ? parsed.WORKER_URL.split(',').map(u => u.trim().replace(/\/$/, '')).filter(Boolean)
      : [],
    corsAllowOrigins: parsed.CORS_ALLOW_ORIGINS
      ? parsed.CORS_ALLOW_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
      : [],
  };
}
