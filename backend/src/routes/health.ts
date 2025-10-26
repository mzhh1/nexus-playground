/**
 * Health Check Route
 */

import { FastifyPluginAsync } from 'fastify';

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async (_request, reply) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        redis: 'unknown',
        postgres: 'unknown',
      },
    };

    // Check Redis
    try {
      await fastify.redis.ping();
      health.services.redis = 'healthy';
    } catch (error) {
      health.services.redis = 'unhealthy';
      health.status = 'degraded';
    }

    // Check PostgreSQL
    try {
      await fastify.pg.query('SELECT 1');
      health.services.postgres = 'healthy';
    } catch (error) {
      health.services.postgres = 'unhealthy';
      health.status = 'degraded';
    }

    const statusCode = health.status === 'healthy' ? 200 : 503;

    return reply.code(statusCode).send(health);
  });
};

export default healthRoute;

