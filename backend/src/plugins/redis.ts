import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import Redis from 'ioredis';
import logger from '../utils/logger';

/**
 * Redis plugin for Fastify
 * Provides a Redis client instance decorated on the Fastify instance
 */

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPlugin: FastifyPluginAsync = async (fastify) => {
  const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  };

  logger.info({ config: { ...redisConfig, password: '***' } }, 'Connecting to Redis');

  const redis = new Redis(redisConfig);

  // Handle connection events
  redis.on('connect', () => {
    logger.info('Redis client connected');
  });

  redis.on('ready', () => {
    logger.info('Redis client ready');
  });

  redis.on('error', (err) => {
    logger.error({ err }, 'Redis client error');
  });

  redis.on('close', () => {
    logger.warn('Redis client connection closed');
  });

  redis.on('reconnecting', () => {
    logger.info('Redis client reconnecting');
  });

  // Test connection
  try {
    await redis.ping();
    logger.info('Redis connection test successful');
  } catch (error) {
    logger.error({ error }, 'Redis connection test failed');
    throw error;
  }

  // Decorate Fastify instance
  fastify.decorate('redis', redis);

  // Close connection on app close
  fastify.addHook('onClose', async () => {
    logger.info('Closing Redis connection');
    await redis.quit();
  });
};

export default fp(redisPlugin, {
  name: 'redis',
  fastify: '4.x',
});

