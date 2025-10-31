/**
 * Protected Rooms Routes (Auth Required)
 * Manage and interact with rooms (requires authentication)
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms';
import { createStateManager } from '../runtime/state-manager';
import { createPerspectiveGenerator } from '../runtime/perspective-generator';
import { generatePlayerId } from '../utils/player-id-generator';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';
import { getGameLogic } from '../games/registry';
import { getEventBus } from '../runtime/event-bus';

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);
  const perspectiveGenerator = createPerspectiveGenerator(fastify, stateManager);

  // ----- Owner-only helpers -----
  async function ensureOwner(request: any, roomId: string) {
    const userId = request.auth?.userId;
    if (!userId) return { ok: false as const, code: 401, error: 'Unauthorized' };
    const room = await roomDAO.getById(roomId);
    if (!room) return { ok: false as const, code: 404, error: 'Room not found' };
    if (room.owner_uid !== userId) return { ok: false as const, code: 403, error: 'Forbidden' };
    return { ok: true as const, room };
  }


  /**
   * POST /api/v1/rooms/:roomId/select-game
   */
  fastify.post<{
    Params: { roomId: string };
    Body: { game_id: string };
  }>('/rooms/:roomId/select-game', async (request, reply) => {
    const { roomId } = request.params;
    const { game_id } = request.body;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }
    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) {
      return reply.code((owner as any).code).send({ error: (owner as any).error });
    }

    if (!game_id) {
      return reply.code(400).send({ error: 'Invalid game ID' });
    }

    try {
      await roomDAO.updateGameId(roomId, game_id);
      const result = await stateManager.selectGame(roomId, game_id);
      if (!result.success) return reply.code(500).send({ error: 'Failed to select game' });
      
      // Clear all player perspective caches when changing game
      await perspectiveGenerator.invalidateAllPerspectives(roomId);
      logger.debug({ roomId, gameId: game_id }, 'Cleared perspective caches on game selection');
      
      logger.info({ roomId, gameId: game_id }, 'Game selected');
      return reply.send({ success: true, game_id });
    } catch (error) {
      logger.error({ error, roomId, gameId: game_id }, 'Failed to select game');
      return reply.code(500).send({ error: 'Failed to select game' });
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/add-player
   */
  fastify.post<{
    Params: { roomId: string };
    Body: {
      player_type: 'human' | 'llm';
      uid?: string;
      display_name: string;
      model_name?: string;
      system_prompt?: string;
    };
  }>('/rooms/:roomId/add-player', async (request, reply) => {
    const { roomId } = request.params;
    const { player_type, uid, display_name, model_name, system_prompt } = request.body;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }
    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) {
      return reply.code((owner as any).code).send({ error: (owner as any).error });
    }

    try {
      const playerId = generatePlayerId(roomId);
      let player: any;
      if (player_type === 'human') {
        player = {
          type: 'human',
          uid: uid || playerId,
          display_name,
          join_time: new Date().toISOString(),
          status: 'online',
        };
      } else {
        player = {
          type: 'llm',
          model_name: model_name || 'gpt-4o-mini',
          system_prompt: system_prompt || '你是一个聪明的游戏玩家',
          display_name,
          join_time: new Date().toISOString(),
          status: 'active',
        };
      }

      const result = await stateManager.addPlayer(roomId, playerId, player);
      if (!result.success) return reply.code(400).send({ error: result.error || 'Failed to add player' });
      logger.info({ roomId, playerId, playerType: player_type }, 'Player added');
      
      // Broadcast player joined event
      getEventBus().broadcastToRoom(roomId, 'player_joined', { 
        player_id: playerId, 
        player 
      });
      
      return reply.send({ success: true, player_id: playerId, player });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to add player');
      return reply.code(500).send({ error: 'Failed to add player' });
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/remove-player
   */
  fastify.post<{
    Params: { roomId: string };
    Body: { player_id: string };
  }>('/rooms/:roomId/remove-player', async (request, reply) => {
    const { roomId } = request.params;
    const { player_id } = request.body;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }
    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) {
      return reply.code((owner as any).code).send({ error: (owner as any).error });
    }

    try {
      const result = await stateManager.removePlayer(roomId, player_id);
      if (!result.success) return reply.code(400).send({ error: result.error || 'Failed to remove player' });
      logger.info({ roomId, playerId: player_id }, 'Player removed');
      
      // Broadcast player left event
      getEventBus().broadcastToRoom(roomId, 'player_left', { 
        player_id 
      });
      
      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, roomId, playerId: player_id }, 'Failed to remove player');
      return reply.code(500).send({ error: 'Failed to remove player' });
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/start|pause|resume|stop
   */
  fastify.post<{
    Params: { roomId: string };
    Body: { role_mapping: Record<string, string> };
  }>('/rooms/:roomId/start', async (request, reply) => {
    const { roomId } = request.params;
    const { role_mapping } = request.body;
    if (!isValidRoomId(roomId)) return reply.code(400).send({ error: 'Invalid room ID format' });
    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) return reply.code((owner as any).code).send({ error: (owner as any).error });

    try {
      const roomState = await stateManager.getRoomState(roomId);
      if (!roomState || !roomState.game_id) return reply.code(400).send({ error: 'Game not selected' });
      const gameId = roomState.game_id as string;
      const result = await stateManager.updateRoomState(roomId, (state) => ({
        ...state,
        role_mapping,
        game_state: getGameLogic(gameId).initState({ players: Object.keys(role_mapping) }),
        room_status: 'playing',
        resume_locked: false,
        history: [],
      }));
      if (!result.success) return reply.code(500).send({ error: 'Failed to start game' });
      await roomDAO.updateStatus(roomId, 'playing');
      getEventBus().broadcastToRoom(roomId, 'game_started', { game_id: gameId, role_mapping });
      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to start game');
      return reply.code(500).send({ error: 'Failed to start game' });
    }
  });

  for (const action of ['pause', 'resume', 'stop'] as const) {
    fastify.post<{ Params: { roomId: string } }>(`/rooms/:roomId/${action}`, async (request, reply) => {
      const { roomId } = request.params;
      if (!isValidRoomId(roomId)) return reply.code(400).send({ error: 'Invalid room ID format' });
      const owner = await ensureOwner(request, roomId);
      if (!('ok' in owner && owner.ok)) return reply.code((owner as any).code).send({ error: (owner as any).error });

      try {
        const roomState = await stateManager.getRoomState(roomId);
        if (!roomState) {
          return reply.code(404).send({ error: 'Room state not found' });
        }

        if (action === 'pause') {
          if (roomState.room_status !== 'playing') {
            return reply.code(400).send({ error: 'Game is not playing' });
          }

          await stateManager.updateRoomStatus(roomId, 'paused', { resumeLocked: false });
          await roomDAO.updateStatus(roomId, 'paused');
        } else if (action === 'resume') {
          if (roomState.room_status !== 'paused') {
            return reply.code(400).send({ error: 'Game is not paused' });
          }

          if (roomState.resume_locked) {
            return reply.code(400).send({ error: 'Game has been stopped and cannot be resumed' });
          }

          await stateManager.updateRoomStatus(roomId, 'playing', { resumeLocked: false });
          await roomDAO.updateStatus(roomId, 'playing');
        } else {
          if (roomState.room_status === 'open') {
            return reply.code(400).send({ error: 'Game has not started' });
          }

          const resetResult = await stateManager.resetGameState(roomId);

          if (!resetResult.success) {
            logger.error({ roomId, error: resetResult.error }, 'Failed to reset room state on stop');
            return reply.code(500).send({ error: 'Failed to stop game' });
          }

          // Clear all player perspective caches
          await perspectiveGenerator.invalidateAllPerspectives(roomId);
          logger.debug({ roomId }, 'Cleared all perspective caches on game stop');

          await roomDAO.updateStatus(roomId, 'open');
          await roomDAO.updateGameId(roomId, null);
        }
        const eventName =
          action === 'pause'
            ? 'game_paused'
            : action === 'resume'
              ? 'game_resumed'
              : 'game_stopped';

        getEventBus().broadcastToRoom(roomId, eventName, {});
        return reply.send({ success: true });
      } catch (error) {
        logger.error({ error, roomId }, `Failed to ${action} game`);
        return reply.code(500).send({ error: `Failed to ${action} game` });
      }
    });
  }

  /**
   * POST /api/v1/rooms/:roomId/restart
   * Restart the game with the same settings
   */
  fastify.post<{ Params: { roomId: string } }>('/rooms/:roomId/restart', async (request, reply) => {
    const { roomId } = request.params;
    if (!isValidRoomId(roomId)) return reply.code(400).send({ error: 'Invalid room ID format' });
    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) return reply.code((owner as any).code).send({ error: (owner as any).error });

    try {
      const roomState = await stateManager.getRoomState(roomId);
      if (!roomState || !roomState.game_id) {
        return reply.code(400).send({ error: 'Game not selected' });
      }

      if (roomState.room_status === 'open') {
        return reply.code(400).send({ error: 'Game has not been started yet' });
      }

      const gameId = roomState.game_id as string;
      const roleMapping = roomState.role_mapping;

      // Validate role mapping
      if (!roleMapping || Object.keys(roleMapping).length === 0) {
        return reply.code(400).send({ error: 'Role mapping not found' });
      }

      // Restart game with same role mapping
      const result = await stateManager.updateRoomState(roomId, (state) => ({
        ...state,
        game_state: getGameLogic(gameId).initState({ players: Object.keys(roleMapping) }),
        room_status: 'playing',
        resume_locked: false,
        history: [],
      }));

      if (!result.success) {
        return reply.code(500).send({ error: 'Failed to restart game' });
      }

      await roomDAO.updateStatus(roomId, 'playing');

      // Broadcast game_restarted event
      getEventBus().broadcastToRoom(roomId, 'game_restarted', { game_id: gameId, role_mapping: roleMapping });

      // Broadcast updated perspectives to all roles
      const updatedState = await stateManager.getRoomState(roomId);
      if (updatedState && updatedState.game_state) {
        const gameLogic = getGameLogic(gameId);
        // History is reset, so both whole and diff history are empty
        const emptyHistory: any[] = [];
        for (const roleId of Object.keys(roleMapping)) {
          const perspective = gameLogic.toRolePerspective(
            updatedState.game_state,
            roleId,
            emptyHistory,
            emptyHistory
          );
          getEventBus().broadcastPerspective(roomId, roleId, perspective);
        }
      }

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to restart game');
      return reply.code(500).send({ error: 'Failed to restart game' });
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
    const userId = (request as any).auth?.userId;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    if (!display_name) {
      return reply.code(400).send({ error: 'Display name is required' });
    }
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
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

