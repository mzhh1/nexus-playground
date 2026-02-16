/**
 * Protected Rooms Routes (Auth Required)
 * Manage and interact with rooms (requires authentication)
 *
 * NOTE: Lobby state (players, roles) is now managed by Nexus Engine DO.
 * This backend only handles:
 *   - Room CRUD (Postgres)
 *   - Issuing JWT tokens for Engine WebSocket connections
 *   - LLM player management (add/remove via backend, then sync to Engine)
 *   - Game start/stop coordination (calling Engine admin API)
 */

import { FastifyPluginAsync } from 'fastify';
import { createRoomDAO } from '../db/rooms.js';
import { createStateManager } from '../runtime/state-manager.js';
import { createAutoPlayerCoordinator } from '../runtime/auto-player-coordinator.js';
import { generatePlayerId } from '../utils/player-id-generator.js';
import { isValidRoomId } from '../utils/room-id-generator.js';
import logger from '../utils/logger.js';
import { getGameLogic, getGameWorkerUrl } from '../games/registry.js';
import { nexusEngine } from '../runtime/nexus-engine-client.js';

const roomsRoutes: FastifyPluginAsync = async (fastify) => {
  const roomDAO = createRoomDAO(fastify);
  const stateManager = createStateManager(fastify);
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
   * Select a game for the room (owner only)
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

      logger.info({ roomId, gameId: game_id }, 'Game selected');
      return reply.send({ success: true, game_id });
    } catch (error) {
      logger.error({ error, roomId, gameId: game_id }, 'Failed to select game');
      return reply.code(500).send({ error: 'Failed to select game' });
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/add-player
   * Add an LLM player to the room (owner only).
   * Human players join via WebSocket to the Engine DO directly.
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
          status: 'online',
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
          memory: '',
        };
      }

      const result = await stateManager.addPlayer(roomId, playerId, player);
      if (!result.success) return reply.code(400).send({ error: result.error || 'Failed to add player' });
      logger.info({ roomId, playerId, playerType: player_type }, 'Player added');

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

      return reply.send({ success: true });
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to update role mapping');
      return reply.code(500).send({ error: 'Failed to update role mapping' });
    }
  });

  /**
   * POST /api/v1/rooms/:roomId/start
   * Start the game. Initializes Engine DO with game config.
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
        validRoleIds = [];
      } else if (Array.isArray(metadataRoleIds)) {
        validRoleIds = metadataRoleIds;
      } else {
        const playerCount = selected_player_count || submittedRoleIds.length;
        if (!metadataRoleIds[playerCount]) {
          const availableCounts = Object.keys(metadataRoleIds).join(', ');
          return reply.code(400).send({
            error: `Invalid player count: ${playerCount}. Available options: ${availableCounts}`
          });
        }
        validRoleIds = metadataRoleIds[playerCount];
      }

      const invalidRoles = submittedRoleIds.filter(id => !validRoleIds.includes(id));
      if (invalidRoles.length > 0) {
        return reply.code(400).send({
          error: `Invalid role IDs: ${invalidRoles.join(', ')}. Expected roles: ${validRoleIds.join(', ')}`
        });
      }

      const missingRoles = validRoleIds.filter(id => !submittedRoleIds.includes(id));
      if (missingRoles.length > 0) {
        return reply.code(400).send({
          error: `Missing role assignments: ${missingRoles.join(', ')}`
        });
      }

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
      }

      const result = await stateManager.updateRoomState(roomId, async (state) => ({
        ...state,
        role_mapping,
        player_list: updatedPlayerList,
        game_state: await gameLogic.initState({ players: Object.keys(role_mapping) }),
        room_status: 'playing',
        resume_locked: false,
        history: [],
        selected_player_count: !Array.isArray(metadataRoleIds) ? selected_player_count : undefined,
      }));
      if (!result.success) return reply.code(500).send({ error: 'Failed to start game' });
      await roomDAO.updateStatus(roomId, 'playing');

      // Initialize Engine DO with game config
      const gameWorkerUrl = getGameWorkerUrl(gameId);
      let engineConfig = null;

      if (gameWorkerUrl) {
        try {
          const engineRoom = await nexusEngine.createRoom({
            roomId,
            ownerId: owner.room.owner_uid,
            gameWorkerUrl,
            config: {
              maxPlayers: validRoleIds.length,
              players: validRoleIds,
            },
            context: { gameId },
          });
          logger.info({ roomId, engineRoom }, 'Created Nexus Engine room');
          engineConfig = {
            connectUrl: engineRoom.connectUrl,
            engineRoomId: engineRoom.roomId,
          };
        } catch (e) {
          logger.error({ error: e, roomId }, 'Failed to create Nexus Engine room');
        }
      }

      // Trigger auto player coordinator (async, non-blocking)
      setImmediate(() => {
        autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
          logger.error({ err, roomId }, 'Auto player coordination failed after game start');
        });
      });

      return reply.send({ success: true, engineConfig });
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

          setImmediate(() => {
            autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
              logger.error({ err, roomId }, 'Auto player coordination failed on resume');
            });
          });
        } else {
          // stop
          if (roomState.room_status === 'open') {
            return reply.code(400).send({ error: 'Game has not started' });
          }
          const resetResult = await stateManager.resetGameState(roomId);
          if (!resetResult.success) {
            return reply.code(500).send({ error: 'Failed to stop game' });
          }
          await roomDAO.updateStatus(roomId, 'open');
          await roomDAO.updateGameId(roomId, null);
        }

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
      }

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

      // Re-initialize Engine DO
      const gameWorkerUrl = getGameWorkerUrl(gameId);
      let engineConfig = null;

      if (gameWorkerUrl) {
        try {
          const engineRoom = await nexusEngine.createRoom({
            roomId,
            ownerId: owner.room.owner_uid,
            gameWorkerUrl,
            config: {
              maxPlayers: Object.keys(roleMapping).length,
              players: Object.keys(roleMapping),
            },
            context: { gameId },
          });
          logger.info({ roomId, engineRoom }, 'Re-initialized Nexus Engine room on restart');
          engineConfig = {
            connectUrl: engineRoom.connectUrl,
            engineRoomId: engineRoom.roomId,
          };
        } catch (e) {
          logger.error({ error: e, roomId }, 'Failed to re-initialize Nexus Engine room on restart');
        }
      }

      // Trigger auto player coordinator (async, non-blocking)
      setImmediate(() => {
        autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
          logger.error({ err, roomId }, 'Auto player coordination failed after game restart');
        });
      });

      return reply.send({ success: true, engineConfig });
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
      const room = await roomDAO.getById(roomId);
      if (!room) {
        return reply.code(404).send({ error: 'Room not found' });
      }

      const roomState = await stateManager.getRoomState(roomId);
      if (!roomState) {
        return reply.code(404).send({ error: 'Room state not found' });
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

      const playerId = generatePlayerId(roomId);
      const player = {
        type: 'human' as const,
        uid: userId,
        display_name,
        join_time: new Date().toISOString(),
        status: 'online' as const,
      };

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
