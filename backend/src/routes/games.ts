/**
 * Games Routes
 * Public endpoints for game metadata
 */

import { FastifyPluginAsync } from 'fastify';
import { getAllGamesMetadata } from '../games/registry.js';

const gamesRoute: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /games
   * Get all available games metadata
   */
  fastify.get('/games', async (_request, reply) => {
    try {
      const games = getAllGamesMetadata();
      return reply.send({ games });
    } catch (error) {
      fastify.log.error(error, 'Failed to get games metadata');
      return reply.code(500).send({
        error: 'Failed to retrieve games metadata',
      });
    }
  });
};

export default gamesRoute;


