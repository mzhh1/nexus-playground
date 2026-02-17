/**
 * Protected Rooms Routes (Auth Required) — v4.0 Simplified
 *
 * After Heavy Engine refactoring, this route handles ONLY:
 *   - Engine connection (JWT signing for WebSocket)
 *
 * All game operations (select game, add/remove players, start/stop,
 * role mapping, actions) are now handled by the Engine DO via WebSocket.
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms.js';
import { isValidRoomId } from '../utils/room-id-generator.js';
import logger from '../utils/logger.js';
import { nexusEngine } from '../runtime/nexus-engine-client.js';

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);

  /**
   * GET /api/v1/rooms/:roomId/engine-connection
   * Get WebSocket URL and signed JWT for Nexus Engine connection.
   * Any authenticated user can request a connection token.
   */
  fastify.get<{ Params: { roomId: string } }>('/rooms/:roomId/engine-connection', async (request, reply) => {
    const { roomId } = request.params;
    const userId = (request as any).auth?.userId;
    const displayName = (request as any).auth?.displayName || userId;

    if (!isValidRoomId(roomId) || !userId) {
      return reply.code(400).send({ error: 'Invalid request' });
    }

    try {
      const room = await roomDAO.getById(roomId);
      if (!room) {
        return reply.code(404).send({ error: 'Room not found' });
      }

      const wsUrl = nexusEngine.getConnectUrl(roomId);
      const token = nexusEngine.generateToken(roomId, userId, displayName);

      return reply.send({
        url: wsUrl,
        token,
      });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to get engine connection');
      return reply.code(500).send({ error: 'Server error' });
    }
  });
};

export default roomsRoutes;
