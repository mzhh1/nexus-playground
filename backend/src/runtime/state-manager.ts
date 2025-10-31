/**
 * State Manager
 * Manages authoritative game state in Redis with version control
 */

import { FastifyInstance } from 'fastify';
import { RoomState, GameState, PlayerList, RoleMapping, HistoryEvent } from '../games/types';
import logger from '../utils/logger';

export class StateManager {
  private readonly ROOM_KEY_PREFIX = 'room:';
  private readonly ROOM_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

  constructor(private fastify: FastifyInstance) {}

  /**
   * Get room state from Redis
   */
  async getRoomState(roomId: string): Promise<RoomState | null> {
    try {
      const key = this.getRoomKey(roomId);
      const data = await this.fastify.redis.get(key);
      
      if (!data) {
        logger.debug({ roomId }, 'Room state not found in Redis');
        return null;
      }
      
      const parsed = JSON.parse(data) as RoomState & { resume_locked?: boolean; is_public?: boolean };
      const state: RoomState = {
        ...parsed,
        resume_locked: typeof parsed.resume_locked === 'boolean' ? parsed.resume_locked : false,
        is_public: typeof parsed.is_public === 'boolean' ? parsed.is_public : true,
      };
      logger.debug({ roomId, version: state.version }, 'Room state retrieved');
      return state;
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to get room state');
      throw error;
    }
  }

  /**
   * Set room state in Redis
   */
  async setRoomState(state: RoomState): Promise<void> {
    try {
      const key = this.getRoomKey(state.room_id);
      const data = JSON.stringify(state);
      
      await this.fastify.redis.setex(key, this.ROOM_TTL, data);
      
      logger.debug(
        { roomId: state.room_id, version: state.version },
        'Room state saved'
      );
    } catch (error) {
      logger.error({ error, roomId: state.room_id }, 'Failed to set room state');
      throw error;
    }
  }

  /**
   * Initialize new room state
   */
  async initializeRoomState(
    roomId: string,
    ownerUid: string,
    gameId: string | null = null
  ): Promise<RoomState> {
    const now = new Date().toISOString();
    
    const state: RoomState = {
      room_id: roomId,
      owner_uid: ownerUid,
      game_id: gameId,
      room_status: 'open',
      is_public: true,
      resume_locked: false,
      player_list: {},
      role_mapping: {},
      game_state: null,
      history: [],
      version: 1,
      created_at: now,
      updated_at: now,
    };
    
    await this.setRoomState(state);
    logger.info({ roomId, ownerUid }, 'Room state initialized');
    
    return state;
  }

  /**
   * Update room state with optimistic locking
   * Returns true if update succeeded, false if version conflict
   */
  async updateRoomState(
    roomId: string,
    updateFn: (state: RoomState) => RoomState | Promise<RoomState>
  ): Promise<{ success: boolean; state?: RoomState; error?: string }> {
    const MAX_RETRIES = 3;
    
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Get current state
        const currentState = await this.getRoomState(roomId);
        
        if (!currentState) {
          return {
            success: false,
            error: 'ROOM_NOT_FOUND',
          };
        }
        
        // Apply update
        const newState = await updateFn(currentState);

        if (typeof newState.resume_locked !== 'boolean') {
          newState.resume_locked = false;
        }
        
        // Increment version
        newState.version = currentState.version + 1;
        newState.updated_at = new Date().toISOString();
        
        // Optimistic lock check (simple version comparison)
        // In production, use Redis transactions (WATCH/MULTI/EXEC)
        const key = this.getRoomKey(roomId);
        const currentData = await this.fastify.redis.get(key);
        
        if (!currentData) {
          return {
            success: false,
            error: 'ROOM_DISAPPEARED',
          };
        }
        
        const checkState = JSON.parse(currentData) as RoomState;
        
        if (checkState.version !== currentState.version) {
          logger.warn(
            {
              roomId,
              expectedVersion: currentState.version,
              actualVersion: checkState.version,
              attempt,
            },
            'Version conflict detected, retrying'
          );
          continue; // Retry
        }
        
        // Save new state
        await this.setRoomState(newState);
        
        logger.debug(
          {
            roomId,
            oldVersion: currentState.version,
            newVersion: newState.version,
          },
          'Room state updated successfully'
        );
        
        return { success: true, state: newState };
      } catch (error) {
        logger.error({ error, roomId, attempt }, 'Failed to update room state');
        
        if (attempt === MAX_RETRIES - 1) {
          return {
            success: false,
            error: 'MAX_RETRIES_EXCEEDED',
          };
        }
      }
    }
    
    return {
      success: false,
      error: 'UNKNOWN_ERROR',
    };
  }

  /**
   * Delete room state
   */
  async deleteRoomState(roomId: string): Promise<void> {
    try {
      const key = this.getRoomKey(roomId);
      await this.fastify.redis.del(key);
      logger.info({ roomId }, 'Room state deleted');
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to delete room state');
      throw error;
    }
  }

  /**
   * Add player to room
   */
  async addPlayer(
    roomId: string,
    playerId: string,
    player: PlayerList[string]
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      // Check if player already exists
      if (state.player_list[playerId]) {
        throw new Error('PLAYER_ALREADY_EXISTS');
      }
      
      // Return a new object to avoid mutating the original state
      return {
        ...state,
        player_list: {
          ...state.player_list,
          [playerId]: player,
        },
      };
    });
  }

  /**
   * Remove player from room
   */
  async removePlayer(
    roomId: string,
    playerId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      if (!state.player_list[playerId]) {
        throw new Error('PLAYER_NOT_FOUND');
      }
      
      // Create new player list without the removed player
      const newPlayerList = { ...state.player_list };
      delete newPlayerList[playerId];
      
      // Create new role mapping without the removed player
      const newRoleMapping: RoleMapping = {};
      for (const [roleId, pid] of Object.entries(state.role_mapping)) {
        if (pid !== playerId) {
          newRoleMapping[roleId] = pid;
        }
      }
      
      // Return a new object to avoid mutating the original state
      return {
        ...state,
        player_list: newPlayerList,
        role_mapping: newRoleMapping,
      };
    });
  }

  /**
   * Update role mapping
   */
  async updateRoleMapping(
    roomId: string,
    roleMapping: RoleMapping
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      // Return a new object to avoid mutating the original state
      return {
        ...state,
        role_mapping: roleMapping,
      };
    });
  }

  /**
   * Update game state
   */
  async updateGameState(
    roomId: string,
    gameState: GameState
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      // Return a new object to avoid mutating the original state
      return {
        ...state,
        game_state: gameState,
      };
    });
  }

  /**
   * Append history event
   */
  async appendHistory(
    roomId: string,
    event: HistoryEvent
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      // Return a new object to avoid mutating the original state
      return {
        ...state,
        history: [...state.history, event],
      };
    });
  }

  /**
   * Update room status
   */
  async updateRoomStatus(
    roomId: string,
    status: RoomState['room_status'],
    options: { resumeLocked?: boolean } = {}
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      const resumeLocked =
        typeof options.resumeLocked === 'boolean'
          ? options.resumeLocked
          : status === 'playing' || status === 'open'
            ? false
            : state.resume_locked;

      // Return a new object to avoid mutating the original state
      return {
        ...state,
        room_status: status,
        resume_locked: resumeLocked,
      };
    });
  }

  async resetGameState(
    roomId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => ({
      ...state,
      room_status: 'open',
      resume_locked: false,
      is_public: state.is_public, // 保留公开状态
      game_id: null,
      role_mapping: {},
      game_state: null,
      history: [],
    }));
  }

  /**
   * Select game for room
   */
  async selectGame(
    roomId: string,
    gameId: string
  ): Promise<{ success: boolean; error?: string }> {
    return this.updateRoomState(roomId, (state) => {
      // Return a new object to avoid mutating the original state
      return {
        ...state,
        game_id: gameId,
        game_state: null, // Reset game state when changing game
        history: [],
        role_mapping: {},
      };
    });
  }

  /**
   * Get room key for Redis
   */
  private getRoomKey(roomId: string): string {
    return `${this.ROOM_KEY_PREFIX}${roomId}`;
  }
}

/**
 * Factory function to create StateManager instance
 */
export function createStateManager(fastify: FastifyInstance): StateManager {
  return new StateManager(fastify);
}

