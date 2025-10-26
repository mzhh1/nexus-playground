/**
 * Nexus Playground Backend Entry Point
 * Main server initialization and startup
 */

// Configure module aliases for runtime
import * as moduleAlias from 'module-alias';
import * as path from 'path';

moduleAlias.addAliases({
  '@games': path.join(__dirname, '../../games'),
  '@': path.join(__dirname, '../..')
});

import 'dotenv/config';
import Fastify from 'fastify';
import logger from './utils/logger';

// Plugins
import redisPlugin from './plugins/redis';
import postgresPlugin from './plugins/postgres';
import corsPlugin from './plugins/cors';

// Routes
import healthRoute from './routes/health';
import myNexusRoutes from './routes/my-nexus';
import roomsRoutes from './routes/rooms';
import actionsRoutes from './routes/actions';
import perspectivesRoutes from './routes/perspectives';

// Runtime
import { getEventBus } from './runtime/event-bus';
import { listAvailableGames } from './games/registry';

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

  // Register plugins
  await fastify.register(corsPlugin);
  await fastify.register(redisPlugin);
  await fastify.register(postgresPlugin);

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
      instance.register(healthRoute);
      instance.register(myNexusRoutes);
      instance.register(roomsRoutes);
      instance.register(actionsRoutes);
      instance.register(perspectivesRoutes);
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

/**
 * Start server
 */
async function start() {
  try {
    const port = parseInt(process.env.BACKEND_PORT || process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    logger.info('Starting Nexus Playground Backend...');
    logger.info({
      nodeEnv: process.env.NODE_ENV,
      port,
      host,
    }, 'Configuration');

    // Build and start server
    const fastify = await buildServer();

    await fastify.listen({ port, host });

    logger.info(
      { port, host, address: fastify.server.address() },
      'Server started successfully'
    );

    logger.info(
      { games: listAvailableGames() },
      'Available games'
    );

    // Initialize event bus keepalive
    const eventBus = getEventBus();
    const keepaliveTimer = eventBus.startKeepaliveTimer(30000); // 30 seconds

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info({ signal }, 'Received shutdown signal');

      // Stop keepalive timer
      clearInterval(keepaliveTimer);

      // Close server
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

// Start the server
if (require.main === module) {
  start();
}

export { buildServer, start };

