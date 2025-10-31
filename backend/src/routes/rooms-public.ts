/**
 * Public Rooms Routes (No Auth Required)
 * Browse and view public rooms
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms';
import { createStateManager } from '../runtime/state-manager';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

const roomsPublicRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);

  /**
   * GET /api/v1/rooms
   * Get list of public rooms (no auth required)
   */
  fastify.get('/rooms', async (_request, reply) => {
    try {
      const rooms = await roomDAO.list({ limit: 50 });
      
      // Get room states from Redis for each room
      const roomsWithState = await Promise.all(
        rooms.map(async (room) => {
          const roomState = await stateManager.getRoomState(room.room_id);
          
          if (!roomState || !roomState.is_public) {
            return null; // Skip non-public rooms
          }
          
          return {
            room_id: room.room_id,
            owner_uid: room.owner_uid,
            game_id: roomState.game_id,
            room_status: roomState.room_status,
            is_public: roomState.is_public,
            player_count: Object.keys(roomState.player_list).length,
            created_at: room.created_at,
          };
        })
      );
      
      // Filter out null values (non-public rooms)
      const publicRooms = roomsWithState.filter((room) => room !== null);
      
      return reply.send({ rooms: publicRooms });
    } catch (error) {
      logger.error({ error }, 'Failed to list rooms');
      return reply.code(500).send({ error: 'Failed to list rooms' });
    }
  });

  /**
   * GET /api/v1/rooms/:roomId
   * Get room information (public view, no auth required)
   */
  fastify.get<{
    Params: { roomId: string };
  }>('/rooms/:roomId', async (request, reply) => {
    const { roomId } = request.params;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    try {
      // Get room from PostgreSQL
      const room = await roomDAO.getById(roomId);

      if (!room) {
        return reply.code(404).send({ error: 'Room not found' });
      }

      // Get room state from Redis
      const roomState = await stateManager.getRoomState(roomId);

      if (!roomState) {
        return reply.code(404).send({ error: 'Room state not found' });
      }

      // Return public information only
      return reply.send({
        room_id: room.room_id,
        owner_uid: room.owner_uid,
        game_id: roomState.game_id,
        room_status: roomState.room_status,
        is_public: roomState.is_public,
        resume_locked: roomState.resume_locked,
        player_count: Object.keys(roomState.player_list).length,
        player_list: roomState.player_list,
        role_mapping: roomState.role_mapping,
        has_game_state: roomState.game_state !== null,
        created_at: room.created_at,
      });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to get room');
      return reply.code(500).send({ error: 'Failed to get room' });
    }
  });
};

export default roomsPublicRoutes;

