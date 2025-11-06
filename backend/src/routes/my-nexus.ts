/**
 * My Nexus Routes
 * Manage user's own nexus (room)
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms.js';
import { createStateManager } from '../runtime/state-manager.js';
import logger from '../utils/logger.js';

const myNexusRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);

  /**
   * GET /api/v1/my-nexus
   * Get or create user's nexus
   */
  fastify.get('/my-nexus', async (request, reply) => {
    const userId = (request as any).auth?.userId;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    try {
      // Get or create room in PostgreSQL
      const room = await roomDAO.getOrCreate(userId);

      // Get or initialize room state in Redis
      let roomState = await stateManager.getRoomState(room.room_id);

      if (!roomState) {
        roomState = await stateManager.initializeRoomState(
          room.room_id,
          userId,
          room.game_id
        );
      }

      return reply.send({
        room_id: room.room_id,
        owner_uid: room.owner_uid,
        game_id: roomState.game_id,
        room_status: roomState.room_status,
        is_public: roomState.is_public,
        resume_locked: roomState.resume_locked,
        player_list: roomState.player_list,
        role_mapping: roomState.role_mapping,
        has_game_state: roomState.game_state !== null,
        created_at: room.created_at,
        updated_at: room.updated_at,
      });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to get or create nexus');
      return reply.code(500).send({ error: 'Failed to get or create nexus' });
    }
  });

};

export default myNexusRoutes;

