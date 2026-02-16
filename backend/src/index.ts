/**
 * Nexus Playground Backend Entry Point
 * Main server initialization and startup
 */

import 'dotenv/config';
import Fastify from 'fastify';
import logger from './utils/logger.js';

// Plugins
import redisPlugin from './plugins/redis.js';
import postgresPlugin from './plugins/postgres.js';
import corsPlugin from './plugins/cors.js';
import authPlugin from './plugins/auth.js';
import appAuthPlugin from './plugins/app-auth.js';

// Routes
import healthRoute from './routes/health.js';
import gamesRoute from './routes/games.js';
import myNexusRoutes from './routes/my-nexus.js';
import roomsRoutes from './routes/rooms.js';
import roomsPublicRoutes from './routes/rooms-public.js';
import actionsRoutes from './routes/actions.js';
import perspectivesProtectedRoutes from './routes/perspectives-protected.js';
import llmLogsPublicRoutes from './routes/llm-logs-public.js';

// Runtime
import { listAvailableGames } from './games/registry.js';

/**
 * Build Fastify server
 */
async function buildServer() {
  const fastify = Fastify({
    logger: true,
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'reqId',
    disableRequestLogging: false,
    trustProxy: true,
  });

  // Register plugins (not auth - that's per-route)
  await fastify.register(corsPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(postgresPlugin);
  await fastify.register(appAuthPlugin); // Application-level auth for LLM calls

  // Add request/response logging hooks
  fastify.addHook('onRequest', async (request) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        headers: request.headers,
      },
      'Incoming request'
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.getResponseTime(),
      },
      'Request completed'
    );
  });

  // Error handler
  fastify.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        error: {
          message: error.message,
          stack: error.stack,
          code: error.code,
        },
        method: request.method,
        url: request.url,
      },
      'Request error'
    );

    reply.status(error.statusCode || 500).send({
      error: error.message || 'Internal Server Error',
      statusCode: error.statusCode || 500,
    });
  });

  // Register routes under /api/v1
  await fastify.register(
    async (instance) => {
      // Public routes (no auth)
      instance.register(healthRoute);
      instance.register(gamesRoute); // Games metadata
      instance.register(roomsPublicRoutes); // Browse public rooms (no auth)
      instance.register(llmLogsPublicRoutes); // LLM interaction logs (public)

      // Protected routes (require auth)
      instance.register(async (protectedInstance) => {
        // Register auth plugin only for protected routes
        await protectedInstance.register(authPlugin);

        // All routes here require authentication
        protectedInstance.register(myNexusRoutes);
        protectedInstance.register(roomsRoutes); // Room management requires auth
        protectedInstance.register(actionsRoutes);
        protectedInstance.register(perspectivesProtectedRoutes); // GET perspective & POST ticket
      });
    },
    { prefix: '/api/v1' }
  );

  // Root route
  fastify.get('/', async () => {
    return {
      name: 'Nexus Playground API',
      version: '1.0.0',
      status: 'running',
      availableGames: listAvailableGames(),
    };
  });

  return fastify;
}

import { initializeRegistry } from './games/registry.js';

/**
 * Start server
 */
async function start() {
  try {
    // Initialize game registry before starting server
    await initializeRegistry();

    const verifiedPort = parseInt(process.env.BACKEND_PORT || process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    logger.info('Starting Nexus Playground Backend...');
    logger.info({
      nodeEnv: process.env.NODE_ENV,
      port: verifiedPort,
      host,
    }, 'Configuration');

    // Build and start server
    const fastify = await buildServer();

    await fastify.listen({ port: verifiedPort, host });

    logger.info(
      { port: verifiedPort, host, address: fastify.server.address() },
      'Server started successfully'
    );

    logger.info(
      { games: listAvailableGames() },
      'Available games'
    );

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');
      await fastify.close();
      logger.info('Server shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.fatal({ error }, 'Uncaught exception');
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.fatal({ reason }, 'Unhandled promise rejection');
      process.exit(1);
    });

  } catch (error) {
    logger.fatal({ error }, 'Failed to start server');
    process.exit(1);
  }
}

// Start the server if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  start();
}

export { buildServer, start };

