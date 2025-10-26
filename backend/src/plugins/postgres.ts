import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';

/**
 * PostgreSQL plugin for Fastify
 * Provides a connection pool decorated on the Fastify instance
 */

declare module 'fastify' {
  interface FastifyInstance {
    pg: {
      pool: Pool;
      query: <T = any>(text: string, params?: any[]) => Promise<{ rows: T[]; rowCount: number }>;
      getClient: () => Promise<PoolClient>;
    };
  }
}

const postgresPlugin: FastifyPluginAsync = async (fastify) => {
  const poolConfig = {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
    database: process.env.POSTGRES_DB || 'nexus',
    user: process.env.POSTGRES_USER || 'nexus_user',
    password: process.env.POSTGRES_PASSWORD,
    max: 20, // Maximum pool size
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  };

  logger.info(
    { config: { ...poolConfig, password: '***' } },
    'Creating PostgreSQL connection pool'
  );

  const pool = new Pool(poolConfig);

  // Handle pool errors
  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected PostgreSQL pool error');
  });

  pool.on('connect', () => {
    logger.debug('New PostgreSQL client connected to pool');
  });

  pool.on('remove', () => {
    logger.debug('PostgreSQL client removed from pool');
  });

  // Test connection
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    logger.info(
      { serverTime: result.rows[0].now },
      'PostgreSQL connection test successful'
    );
    client.release();
  } catch (error) {
    logger.error({ error }, 'PostgreSQL connection test failed');
    throw error;
  }

  // Helper function for simple queries
  const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      logger.debug(
        { query: text, duration, rowCount: result.rowCount },
        'PostgreSQL query executed'
      );
      return {
        rows: result.rows,
        rowCount: result.rowCount ?? 0,
      };
    } catch (error) {
      logger.error({ error, query: text, params }, 'PostgreSQL query error');
      throw error;
    }
  };

  // Helper function to get a client for transactions
  const getClient = async (): Promise<PoolClient> => {
    return pool.connect();
  };

  // Decorate Fastify instance
  fastify.decorate('pg', {
    pool,
    query,
    getClient,
  });

  // Close pool on app close
  fastify.addHook('onClose', async () => {
    logger.info('Closing PostgreSQL connection pool');
    await pool.end();
  });
};

export default fp(postgresPlugin, {
  name: 'postgres',
  fastify: '4.x',
});

