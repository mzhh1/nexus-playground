/**
 * My Nexus Routes — v4.0 Simplified
 *
 * Get or create user's room. Returns Postgres room info + Engine JWT.
 * Room state (players, game config) is now managed entirely by the Engine DO.
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms.js';
import { nexusEngine } from '../runtime/nexus-engine-client.js';
import { getGameWorkerUrl } from '../games/registry.js';
import logger from '../utils/logger.js';

const myNexusRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);

  /**
   * GET /api/v1/my-nexus
   * Get or create user's nexus (room).
   * Also ensures the Engine DO is initialized.
   */
  fastify.get('/my-nexus', async (request, reply) => {
    const userId = (request as any).auth?.userId;
    const displayName = (request as any).auth?.displayName || userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Get or create room in PostgreSQL
      const room = await roomDAO.getOrCreate(userId);

      // Ensure Engine DO exists for this room (idempotent)
      // Pass game worker URL if a game is already selected
      let gameWorkerUrl: string | undefined;
      if (room.game_id) {
        try {
          gameWorkerUrl = getGameWorkerUrl(room.game_id);
        } catch (_) { /* game not found, no-op */ }
      }

      try {
        await nexusEngine.createRoom({
          roomId: room.room_id,
          ownerId: userId,
          ownerDisplayName: displayName,
          ...(gameWorkerUrl && room.game_id
            ? {
              gameWorkerUrl,
              context: { gameId: room.game_id },
            }
            : {}),
        });
      } catch (e) {
        logger.warn({ error: e, roomId: room.room_id }, 'Engine DO creation skipped');
      }

      // Generate engine connection token
      const wsUrl = nexusEngine.getConnectUrl(room.room_id);
      const token = nexusEngine.generateToken(room.room_id, userId, displayName);

      return reply.send({
        room_id: room.room_id,
        owner_uid: room.owner_uid,
        game_id: room.game_id,
        room_status: room.room_status,
        is_public: room.is_public,
        created_at: room.created_at,
        updated_at: room.updated_at,
        // Engine connection info
        engine: {
          url: wsUrl,
          token,
        },
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get or create nexus');
      return reply.code(500).send({ error: 'Failed to get or create nexus' });
    }
  });
};

export default myNexusRoutes;
