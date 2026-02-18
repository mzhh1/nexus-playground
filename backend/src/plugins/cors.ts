import { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';

/**
 * CORS plugin configuration
 * Allows cross-origin requests from frontend
 */

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // In development, allow all origins
      if (process.env.NODE_ENV === 'development') {
        cb(null, true);
        return;
      }

      // In production, restrict to specific origins
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
        'http://localhost',
        'http://localhost:80',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'https://nexus.mzhh.xyz',
        'https://np-llm-monitor.mzhh.xyz',
      ];

      // Allow Vercel preview deployments
      if (origin && (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin))) {
        cb(null, true);
        return;
      }

      cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'X-Client-Id',
      'Content-Type',
      'X-Request-Id',
    ],
    exposedHeaders: ['X-Request-Id'],
  });
};

export default fp(corsPlugin, {
  name: 'cors',
  fastify: '4.x',
});

