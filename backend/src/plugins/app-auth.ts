/**
 * Application Authentication Plugin
 * Provides application-level authentication for system operations (LLM calls, etc.)
 * Uses client_credentials flow to obtain app-level access token
 */

import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { OAuthAppClient, createAuthBridge } from '@autolabz/oauth-app-sdk';
import { createLLMClient } from '@autolabz/llmapi-sdk';
import logger from '../utils/logger.js';

/**
 * Application auth client types
 */
declare module 'fastify' {
  interface FastifyInstance {
    appAuth: {
      llmClient: ReturnType<typeof createLLMClient>;
    };
  }
}

/**
 * Application authentication plugin
 * Initializes app-level OAuth client and LLM client for system operations
 */
const appAuthPlugin: FastifyPluginAsync = async (fastify) => {
  // Validate required environment variables
  const clientId = process.env.OAUTH_APP_CLIENT_ID;
  const clientSecret = process.env.OAUTH_APP_CLIENT_SECRET;
  const authServiceUrl = process.env.AUTH_BASE_URL;
  const llmApiBaseUrl = process.env.LLMAPI_BASE_URL;

  if (!clientId || !clientSecret) {
    logger.warn(
      'OAUTH_APP_CLIENT_ID or OAUTH_APP_CLIENT_SECRET not configured. ' +
      'LLM players will not be available. Set these environment variables to enable LLM functionality.'
    );
    
    // Create a dummy llmClient that throws errors when used
    const dummyLLMClient = {
      chat: async () => {
        throw new Error('LLM functionality not configured. Please set OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET.');
      },
      getChatContent: async () => {
        throw new Error('LLM functionality not configured. Please set OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET.');
      },
      chatStream: async () => {
        throw new Error('LLM functionality not configured. Please set OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET.');
      },
      health: async () => {
        throw new Error('LLM functionality not configured. Please set OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET.');
      },
    } as any;
    
    fastify.decorate('appAuth', {
      llmClient: dummyLLMClient,
    });
    
    return;
  }

  if (!authServiceUrl || !llmApiBaseUrl) {
    throw new Error(
      'AUTH_BASE_URL and LLMAPI_BASE_URL must be configured for app authentication'
    );
  }

  logger.info('Initializing application authentication...');

  // Create OAuth app client (client_credentials flow)
  const appClient = new OAuthAppClient({
    clientId,
    clientSecret,
    authServiceUrl,
  });

  // Create AuthBridge for app-level operations
  const appAuthBridge = createAuthBridge(appClient, {
    onUnauthorized: () => {
      logger.error(
        'Application token authorization failed. ' +
        'Please verify OAUTH_APP_CLIENT_ID and OAUTH_APP_CLIENT_SECRET are correct.'
      );
    },
  });

  // Create LLM client with app-level authentication
  const llmClient = createLLMClient({
    baseURL: llmApiBaseUrl,
    auth: appAuthBridge,
  });

  // Decorate Fastify instance with app auth clients
  fastify.decorate('appAuth', {
    llmClient,
  });

  logger.info(
    {
      clientId,
      authServiceUrl,
      llmApiBaseUrl,
    },
    'Application authentication initialized successfully'
  );
};

export default fp(appAuthPlugin, {
  name: 'app-auth',
  dependencies: [], // No dependencies on other plugins
});

