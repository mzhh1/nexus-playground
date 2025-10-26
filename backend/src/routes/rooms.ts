/**
 * Rooms Routes
 * Access other users' rooms
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms';
import { createStateManager } from '../runtime/state-manager';
import { generatePlayerId } from '../utils/player-id-generator';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);

  /**
   * GET /api/v1/rooms/:roomId
   * Get room information (public view)
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

  /**
   * POST /api/v1/rooms/:roomId/join
   * Join a room as a human player
   */
  fastify.post<{
    Params: { roomId: string };
    Body: { display_name: string };
  }>('/rooms/:roomId/join', async (request, reply) => {
    const { roomId } = request.params;
    const { display_name } = request.body;
    const userId = request.headers['x-user-id'] as string || 'guest_' + Date.now();

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    if (!display_name) {
      return reply.code(400).send({ error: 'Display name is required' });
    }

    try {
      // Check if room exists
      const room = await roomDAO.getById(roomId);

      if (!room) {
        return reply.code(404).send({ error: 'Room not found' });
      }

      // Get room state
      const roomState = await stateManager.getRoomState(roomId);

      if (!roomState) {
        return reply.code(404).send({ error: 'Room state not found' });
      }

      // Check if room is open for joining
      if (roomState.room_status !== 'open') {
        return reply.code(400).send({ error: 'Room is not open for joining' });
      }

      // Check if user is already in the room
      for (const [playerId, player] of Object.entries(roomState.player_list)) {
        if (player.type === 'human' && player.uid === userId) {
          return reply.send({ 
            success: true, 
            player_id: playerId,
            message: 'Already in room'
          });
        }
      }

      // Generate player ID
      const playerId = generatePlayerId(roomId);

      // Create player object
      const player = {
        type: 'human' as const,
        uid: userId,
        display_name,
        join_time: new Date().toISOString(),
        status: 'online' as const,
      };

      // Add player to room
      const result = await stateManager.addPlayer(roomId, playerId, player);

      if (!result.success) {
        return reply.code(400).send({ error: result.error || 'Failed to join room' });
      }

      logger.info({ roomId, playerId, userId, displayName: display_name }, 'User joined room');

      return reply.send({ 
        success: true, 
        player_id: playerId,
        player 
      });
    } catch (error) {
      logger.error({ error, roomId, userId }, 'Failed to join room');
      return reply.code(500).send({ error: 'Failed to join room' });
    }
  });
};

export default roomsRoutes;

