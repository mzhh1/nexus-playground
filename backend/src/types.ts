export interface Env {
  // Logto
  ISSUER_ENDPOINT: string;
  WORKER_RESOURCE_INDICATOR: string;
  DEBUG?: string;

  // D1
  DB: D1Database;

  // Nexus Engine
  NEXUS_ENGINE_URL: string;
  NEXUS_ENGINE_ADMIN_SECRET: string;
  NEXUS_ENGINE_JWT_SECRET: string;

  // LLM Webhook
  LLM_WEBHOOK_SECRET?: string;
  OPENAI_API_BASE?: string;
  OPENAI_API_KEY?: string;

  // Game Workers
  WORKER_URL?: string;

  // CORS
  CORS_ALLOW_ORIGINS?: string;
}

export interface Variables {
  user?: {
    sub: string;
    scope?: string;
    iss?: string;
    aud?: string | string[];
    exp?: number;
  };
  guestId?: string;
}
