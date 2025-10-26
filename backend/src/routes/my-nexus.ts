/**
 * My Nexus Routes
 * Manage user's own nexus (room)
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms';
import { createStateManager } from '../runtime/state-manager';
import { getGameLogic, gameExists } from '../games/registry';
import { generatePlayerId } from '../utils/player-id-generator';
import { getEventBus } from '../runtime/event-bus';
import logger from '../utils/logger';

const myNexusRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);
  const eventBus = getEventBus();

  /**
   * GET /api/v1/my-nexus
   * Get or create user's nexus
   */
  fastify.get('/my-nexus', async (request, reply) => {
    // M0: Authentication placeholder - in production, get from req.auth.userId
    const userId = request.headers['x-user-id'] as string || 'test_user_1';

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

  /**
   * POST /api/v1/my-nexus/select-game
   * Select a game for the nexus
   */
  fastify.post<{
    Body: { game_id: string };
  }>('/my-nexus/select-game', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';
    const { game_id } = request.body;

    if (!game_id || !gameExists(game_id)) {
      return reply.code(400).send({ error: 'Invalid game ID' });
    }

    try {
      // Get user's room
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      // Update room in PostgreSQL
      await roomDAO.updateGameId(room.room_id, game_id);

      // Update room state in Redis
      const result = await stateManager.selectGame(room.room_id, game_id);

      if (!result.success) {
        return reply.code(500).send({ error: 'Failed to select game' });
      }

      logger.info({ roomId: room.room_id, gameId: game_id }, 'Game selected');

      return reply.send({ success: true, game_id });
    } catch (error) {
      logger.error({ error, userId, gameId: game_id }, 'Failed to select game');
      return reply.code(500).send({ error: 'Failed to select game' });
    }
  });

  /**
   * POST /api/v1/my-nexus/add-player
   * Add a player to the nexus
   */
  fastify.post<{
    Body: {
      player_type: 'human' | 'llm';
      uid?: string;
      display_name: string;
      model_name?: string;
      system_prompt?: string;
    };
  }>('/my-nexus/add-player', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';
    const { player_type, uid, display_name, model_name, system_prompt } = request.body;

    try {
      // Get user's room
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      // Generate player ID
      const playerId = generatePlayerId(room.room_id);

      // Create player object
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

      // Add player to room state
      const result = await stateManager.addPlayer(room.room_id, playerId, player);

      if (!result.success) {
        return reply.code(400).send({ error: result.error || 'Failed to add player' });
      }

      logger.info({ roomId: room.room_id, playerId, playerType: player_type }, 'Player added');

      return reply.send({ success: true, player_id: playerId, player });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to add player');
      return reply.code(500).send({ error: 'Failed to add player' });
    }
  });

  /**
   * POST /api/v1/my-nexus/remove-player
   * Remove a player from the nexus
   */
  fastify.post<{
    Body: { player_id: string };
  }>('/my-nexus/remove-player', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';
    const { player_id } = request.body;

    try {
      // Get user's room
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      // Remove player from room state
      const result = await stateManager.removePlayer(room.room_id, player_id);

      if (!result.success) {
        return reply.code(400).send({ error: result.error || 'Failed to remove player' });
      }

      logger.info({ roomId: room.room_id, playerId: player_id }, 'Player removed');

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, userId, playerId: player_id }, 'Failed to remove player');
      return reply.code(500).send({ error: 'Failed to remove player' });
    }
  });

  /**
   * POST /api/v1/my-nexus/start
   * Start the game with role mapping
   */
  fastify.post<{
    Body: { role_mapping: Record<string, string> };
  }>('/my-nexus/start', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';
    const { role_mapping } = request.body;

    try {
      // Get user's room
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      // Get room state
      const roomState = await stateManager.getRoomState(room.room_id);

      if (!roomState || !roomState.game_id) {
        return reply.code(400).send({ error: 'Game not selected' });
      }

      // Validate role mapping
      const gameLogic = getGameLogic(roomState.game_id);
      const metadata = gameLogic.getMetadata();

      // Check player count
      const playerCount = Object.keys(role_mapping).length;
      if (playerCount < metadata.minPlayers || playerCount > metadata.maxPlayers) {
        return reply.code(400).send({
          error: `This game requires ${metadata.minPlayers}-${metadata.maxPlayers} players`,
        });
      }

      // Initialize game state
      const players = Object.keys(role_mapping);
      const gameState = gameLogic.initState({ players });

      // Update room state
      const result = await stateManager.updateRoomState(room.room_id, (state) => {
        // Return a new object to avoid mutating the original state
        return {
          ...state,
          role_mapping: role_mapping,
          game_state: gameState,
          room_status: 'playing',
          history: [],
        };
      });

      if (!result.success) {
        return reply.code(500).send({ error: 'Failed to start game' });
      }

      // Update PostgreSQL
      await roomDAO.updateStatus(room.room_id, 'playing');

      logger.info({ roomId: room.room_id, gameId: roomState.game_id }, 'Game started');

      // Broadcast to all SSE clients in the room
      eventBus.broadcastToRoom(room.room_id, 'game_started', { 
        game_id: roomState.game_id,
        role_mapping 
      });

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to start game');
      return reply.code(500).send({ error: 'Failed to start game' });
    }
  });

  /**
   * POST /api/v1/my-nexus/pause
   * Pause the game
   */
  fastify.post('/my-nexus/pause', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';

    try {
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      await stateManager.updateRoomStatus(room.room_id, 'paused');
      await roomDAO.updateStatus(room.room_id, 'paused');

      logger.info({ roomId: room.room_id }, 'Game paused');

      eventBus.broadcastToRoom(room.room_id, 'game_paused', {});

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to pause game');
      return reply.code(500).send({ error: 'Failed to pause game' });
    }
  });

  /**
   * POST /api/v1/my-nexus/resume
   * Resume the game
   */
  fastify.post('/my-nexus/resume', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';

    try {
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      await stateManager.updateRoomStatus(room.room_id, 'playing');
      await roomDAO.updateStatus(room.room_id, 'playing');

      logger.info({ roomId: room.room_id }, 'Game resumed');

      eventBus.broadcastToRoom(room.room_id, 'game_resumed', {});

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to resume game');
      return reply.code(500).send({ error: 'Failed to resume game' });
    }
  });

  /**
   * POST /api/v1/my-nexus/stop
   * Stop the game
   */
  fastify.post('/my-nexus/stop', async (request, reply) => {
    const userId = request.headers['x-user-id'] as string || 'test_user_1';

    try {
      const room = await roomDAO.getByOwnerUid(userId);

      if (!room) {
        return reply.code(404).send({ error: 'Nexus not found' });
      }

      await stateManager.updateRoomStatus(room.room_id, 'finished');
      await roomDAO.updateStatus(room.room_id, 'finished');

      logger.info({ roomId: room.room_id }, 'Game stopped');

      eventBus.broadcastToRoom(room.room_id, 'game_stopped', {});

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, userId }, 'Failed to stop game');
      return reply.code(500).send({ error: 'Failed to stop game' });
    }
  });
};

export default myNexusRoutes;

