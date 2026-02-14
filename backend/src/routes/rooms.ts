/**
 * Protected Rooms Routes (Auth Required)
 * Manage and interact with rooms (requires authentication)
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms.js';
import { createStateManager } from '../runtime/state-manager.js';
import { createPerspectiveGenerator } from '../runtime/perspective-generator.js';
import { createAutoPlayerCoordinator } from '../runtime/auto-player-coordinator.js';
import { generatePlayerId } from '../utils/player-id-generator.js';
import { isValidRoomId } from '../utils/room-id-generator.js';
import logger from '../utils/logger.js';
import { getGameLogic } from '../games/registry.js';
import { getEventBus } from '../runtime/event-bus.js';
import { broadcastPerspectivesToAllPlayers } from '../utils/perspective-broadcast.js';
import { nexusEngine } from '../runtime/nexus-engine-client.js';
import { getGameWorkerUrl } from '../games/registry.js';

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);
  const perspectiveGenerator = createPerspectiveGenerator(fastify, stateManager);
  const autoPlayerCoordinator = createAutoPlayerCoordinator(fastify);

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
      temperature?: number;
    };
  }>('/rooms/:roomId/add-player', async (request, reply) => {
    const { roomId } = request.params;
    const { player_type, uid, display_name, model_name, system_prompt, temperature } = request.body;

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
          status: 'offline', // Will be set to 'online' when SSE connection is established
        };
      } else {
        player = {
          type: 'llm',
          model_name: model_name || 'gpt-4o-mini',
          system_prompt: system_prompt || '你是一个聪明的游戏玩家',
          temperature: temperature ?? 0.7,
          display_name,
          join_time: new Date().toISOString(),
          status: 'active',
          memory: '', // Initialize empty memory (cleared when game starts)
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
   * POST /api/v1/rooms/:roomId/update-role-mapping
   * Update role mapping without starting the game
   */
  fastify.post<{
    Params: { roomId: string };
    Body: { role_mapping: Record<string, string>; selected_player_count?: number };
  }>('/rooms/:roomId/update-role-mapping', async (request, reply) => {
    const { roomId } = request.params;
    const { role_mapping, selected_player_count } = request.body;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) {
      return reply.code((owner as any).code).send({ error: (owner as any).error });
    }

    try {
      const result = await stateManager.updateRoleMapping(roomId, role_mapping, selected_player_count);
      if (!result.success) {
        return reply.code(400).send({ error: result.error || 'Failed to update role mapping' });
      }

      logger.info({ roomId, roleMapping: role_mapping, selectedPlayerCount: selected_player_count }, 'Role mapping updated');

      // Broadcast role mapping updated event
      getEventBus().broadcastToRoom(roomId, 'role_mapping_updated', {
        role_mapping,
        selected_player_count
      });

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to update role mapping');
      return reply.code(500).send({ error: 'Failed to update role mapping' });
    }
  });

  /**
   * Helper function to broadcast game started/restarted events and initial perspectives
   */
  async function broadcastGameStarted(
    roomId: string,
    gameId: string,
    roleMapping: Record<string, string>,
    eventType: 'game_started' | 'game_restarted',
    engineConfig?: any
  ) {
    // Clear perspective cache for all roles (important for restart/start)
    // This ensures that when clients reconnect (e.g., page refresh), they get the fresh perspective
    await perspectiveGenerator.invalidateAllPerspectives(roomId);

    // Broadcast game started/restarted event
    getEventBus().broadcastToRoom(roomId, eventType, {
      game_id: gameId,
      role_mapping: roleMapping,
      engine_config: engineConfig
    });

    // Generate and broadcast initial perspectives to all players (including spectators)
    await broadcastPerspectivesToAllPlayers(roomId, stateManager, perspectiveGenerator, getEventBus());

    // Trigger auto player coordinator for initial turn (async, non-blocking)
    setImmediate(() => {
      autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
        logger.error({ err, roomId, eventType }, 'Auto player coordination failed after game start');
      });
    });
  }

  /**
   * POST /api/v1/rooms/:roomId/start|pause|resume|stop
   */
  fastify.post<{
    Params: { roomId: string };
    Body: {
      role_mapping: Record<string, string>;
      selected_player_count?: number;
    };
  }>('/rooms/:roomId/start', async (request, reply) => {
    const { roomId } = request.params;
    const { role_mapping, selected_player_count } = request.body;
    if (!isValidRoomId(roomId)) return reply.code(400).send({ error: 'Invalid room ID format' });
    const owner = await ensureOwner(request, roomId);
    if (!('ok' in owner && owner.ok)) return reply.code((owner as any).code).send({ error: (owner as any).error });

    try {
      const roomState = await stateManager.getRoomState(roomId);
      if (!roomState || !roomState.game_id) return reply.code(400).send({ error: 'Game not selected' });
      const gameId = roomState.game_id as string;
      const gameLogic = getGameLogic(gameId);
      const metadata = await gameLogic.getMetadata();

      // 验证角色映射的合法性
      const submittedRoleIds = Object.keys(role_mapping);
      const metadataRoleIds = metadata.roleIds;

      let validRoleIds: string[] = [];

      if (!metadataRoleIds) {
        validRoleIds = []; // Should handle this case, maybe throw error
      } else if (Array.isArray(metadataRoleIds)) {
        // 传统格式：直接验证
        validRoleIds = metadataRoleIds;
      } else {
        // 多人数配置：根据提交的人数或 selected_player_count 验证
        const playerCount = selected_player_count || submittedRoleIds.length;

        if (!metadataRoleIds[playerCount]) {
          const availableCounts = Object.keys(metadataRoleIds).join(', ');
          return reply.code(400).send({
            error: `Invalid player count: ${playerCount}. Available options: ${availableCounts}`
          });
        }

        validRoleIds = metadataRoleIds[playerCount];
      }

      // 验证所有提交的角色都在有效列表中
      const invalidRoles = submittedRoleIds.filter(id => !validRoleIds.includes(id));
      if (invalidRoles.length > 0) {
        return reply.code(400).send({
          error: `Invalid role IDs: ${invalidRoles.join(', ')}. Expected roles: ${validRoleIds.join(', ')}`
        });
      }

      // 验证所有必需角色都已分配
      const missingRoles = validRoleIds.filter(id => !submittedRoleIds.includes(id));
      if (missingRoles.length > 0) {
        return reply.code(400).send({
          error: `Missing role assignments: ${missingRoles.join(', ')}`
        });
      }

      logger.info(
        {
          roomId,
          gameId,
          roleCount: validRoleIds.length,
          isMultiPlayerCount: !Array.isArray(metadataRoleIds),
          selectedPlayerCount: selected_player_count
        },
        'Role mapping validated successfully'
      );

      // Clear LLM player memory if game enables memory system
      let updatedPlayerList = roomState.player_list;
      if (metadata.enable_llm_memory) {
        updatedPlayerList = Object.fromEntries(
          Object.entries(roomState.player_list).map(([id, player]) => {
            if (player.type === 'llm') {
              return [id, { ...player, memory: '' }];
            }
            return [id, player];
          })
        );
        logger.info(
          { roomId, gameId, llmPlayerCount: Object.values(roomState.player_list).filter(p => p.type === 'llm').length },
          'Cleared LLM player memory for new game'
        );
      }

      const result = await stateManager.updateRoomState(roomId, async (state) => ({
        ...state,
        role_mapping,
        player_list: updatedPlayerList,
        game_state: await gameLogic.initState({ players: Object.keys(role_mapping) }),
        room_status: 'playing',
        resume_locked: false,
        history: [],
        // 保存选择的人数（仅多人数配置游戏）
        selected_player_count: !Array.isArray(metadataRoleIds) ? selected_player_count : undefined,
      }));
      if (!result.success) return reply.code(500).send({ error: 'Failed to start game' });
      await roomDAO.updateStatus(roomId, 'playing');

      // 4. Create Room in Nexus Engine
      const gameWorkerUrl = getGameWorkerUrl(gameId);
      let engineConfig = null;

      if (gameWorkerUrl) {
        try {
          const engineRoom = await nexusEngine.createRoom({
            roomId: roomId, // Use same ID or let engine generate
            gameWorkerUrl,
            config: {
              maxPlayers: validRoleIds.length,
              // Pass other config if needed
            },
            context: {
              ownerId: owner.room.owner_uid,
              gameId
            }
          });
          logger.info({ roomId, engineRoom }, 'Created Nexus Engine room');
          engineConfig = {
            connectUrl: engineRoom.connectUrl,
            engineRoomId: engineRoom.roomId
          };
        } catch (e) {
          logger.error({ error: e, roomId }, 'Failed to create Nexus Engine room (continuing with legacy flow if needed)');
          // For now, we might want to fail hard if Engine is required
          // return reply.code(500).send({ error: 'Failed to create game engine container' });
        }
      }

      // Broadcast game started event and initial perspectives
      // Include engine config
      await broadcastGameStarted(roomId, gameId, role_mapping, 'game_started', engineConfig);

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

          // Trigger auto player coordinator when resuming (async, non-blocking)
          setImmediate(() => {
            autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
              logger.error({ err, roomId }, 'Auto player coordination failed on resume');
            });
          });
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

      const gameLogic = getGameLogic(gameId);
      const metadata = await gameLogic.getMetadata();

      // Clear LLM player memory if game enables memory system
      let updatedPlayerList = roomState.player_list;
      if (metadata.enable_llm_memory) {
        updatedPlayerList = Object.fromEntries(
          Object.entries(roomState.player_list).map(([id, player]) => {
            if (player.type === 'llm') {
              return [id, { ...player, memory: '' }];
            }
            return [id, player];
          })
        );
        logger.info(
          { roomId, gameId, llmPlayerCount: Object.values(roomState.player_list).filter(p => p.type === 'llm').length },
          'Cleared LLM player memory for game restart'
        );
      }

      // Restart game with same role mapping
      const result = await stateManager.updateRoomState(roomId, async (state) => ({
        ...state,
        player_list: updatedPlayerList,
        game_state: await gameLogic.initState({ players: Object.keys(roleMapping) }),
        room_status: 'playing',
        resume_locked: false,
        history: [],
      }));

      if (!result.success) {
        return reply.code(500).send({ error: 'Failed to restart game' });
      }

      await roomDAO.updateStatus(roomId, 'playing');

      // Broadcast game restarted event and initial perspectives
      await broadcastGameStarted(roomId, gameId, roleMapping, 'game_restarted');

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
        status: 'offline' as const, // Will be set to 'online' when SSE connection is established
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

  /**
   * GET /api/v1/rooms/:roomId/engine-connection
   * Get WebSocket URL and Token for Nexus Engine
   */
  fastify.get<{ Params: { roomId: string } }>('/rooms/:roomId/engine-connection', async (request, reply) => {
    const { roomId } = request.params;
    const userId = (request as any).auth?.userId;

    if (!isValidRoomId(roomId) || !userId) {
      return reply.code(400).send({ error: 'Invalid request' });
    }

    try {
       const roomState = await stateManager.getRoomState(roomId);
       if (!roomState || roomState.room_status !== 'playing') {
           return reply.code(400).send({ error: 'Game not running' });
       }
       
       // Deterministic URL for M0 (Assuming engine uses same Host)
       // In PROD, we should probably store the specific Engine URL in DB
       // For now, we reconstruct it using env var
       const engineBaseUrl = process.env.NEXUS_ENGINE_URL || 'http://localhost:8787';
       const wsUrl = engineBaseUrl.replace('http', 'ws') + `/connect/${roomId}`;
       
       // Determine role
       // Note: Token generation logic is simplified here.
       // In a real scenario, we check if user is in player_list or role_mapping
       // to assign correct role.
       let role = 'spectator';
       for (const [r, u] of Object.entries(roomState.role_mapping || {})) {
           // role_mapping maps RoleID -> PlayerID
           // We need to look up PlayerID -> UserID in player_list
           const playerId = u;
           const player = roomState.player_list[playerId];
           if (player && player.type === "human" && player.uid === userId) {
               role = r;
               break;
           }
       }
       
       const token = nexusEngine.generateToken(roomId, userId, role);
       
       return reply.send({
           url: wsUrl,
           token,
           role
       });

    } catch (error) {
        logger.error({ error, roomId }, 'Failed to get engine connection');
        return reply.code(500).send({ error: 'Server error' });
    }
  });
};

export default roomsRoutes;

