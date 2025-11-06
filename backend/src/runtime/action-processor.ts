/**
 * Action Processor
 * Handles action validation, application, and state updates with distributed locking
 */

import { FastifyInstance } from 'fastify';
import { StateManager } from './state-manager.js';
import { getGameLogic } from '../games/registry.js';
import { Action, HistoryEvent } from '../games/types.js';
import logger from '../utils/logger.js';

export class ActionProcessor {
  private readonly LOCK_TTL = 10; // 10 seconds
  private readonly LOCK_KEY_PREFIX = 'lock:action:';

  constructor(
    private fastify: FastifyInstance,
    private stateManager: StateManager
  ) {}

  /**
   * Process action with distributed locking
   */
  async processAction(
    roomId: string,
    action: Action
  ): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
  }> {
    const lockKey = this.getLockKey(roomId);
    const lockValue = `${Date.now()}_${Math.random()}`;

    try {
      // Acquire lock
      const lockAcquired = await this.acquireLock(lockKey, lockValue);

      if (!lockAcquired) {
        logger.warn({ roomId, action }, 'Failed to acquire lock for action processing');
        return {
          success: false,
          error: '系统繁忙，请稍后重试',
          errorCode: 'LOCK_FAILED',
        };
      }

      logger.debug({ roomId, action, lockValue }, 'Lock acquired for action processing');

      // Process action
      const result = await this.processActionWithLock(roomId, action);

      return result;
    } finally {
      // Release lock
      await this.releaseLock(lockKey, lockValue);
      logger.debug({ roomId, lockValue }, 'Lock released');
    }
  }

  /**
   * Process action (assumes lock is held)
   */
  private async processActionWithLock(
    roomId: string,
    action: Action
  ): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
  }> {
    try {
      // Get room state
      const roomState = await this.stateManager.getRoomState(roomId);

      if (!roomState) {
        return {
          success: false,
          error: '房间不存在',
          errorCode: 'ROOM_NOT_FOUND',
        };
      }

      // Validate room status
      if (roomState.room_status !== 'playing') {
        return {
          success: false,
          error: '游戏未开始或已暂停',
          errorCode: 'GAME_NOT_PLAYING',
        };
      }

      // Validate game is selected
      if (!roomState.game_id || !roomState.game_state) {
        return {
          success: false,
          error: '游戏未初始化',
          errorCode: 'GAME_NOT_INITIALIZED',
        };
      }

      // Get game logic
      const gameLogic = getGameLogic(roomState.game_id);

      // Validate it's the role's turn
      const currentRole = gameLogic.getCurrentRole(roomState.game_state);

      if (currentRole !== action.role_id) {
        return {
          success: false,
          error: '不是你的回合',
          errorCode: 'NOT_YOUR_TURN',
        };
      }

      // Validate role is mapped to a player
      const playerId = roomState.role_mapping[action.role_id];

      if (!playerId) {
        return {
          success: false,
          error: '角色未分配玩家',
          errorCode: 'ROLE_NOT_MAPPED',
        };
      }

      // Apply action
      const actionResult = gameLogic.applyAction(roomState.game_state, action);

      if (!actionResult.success) {
        logger.warn({ roomId, action, error: actionResult.error }, 'Action validation failed');
        return {
          success: false,
          error: actionResult.error,
          errorCode: actionResult.errorCode,
        };
      }

      // Create history event
      const historyEvent: HistoryEvent = {
        turn: roomState.history.length + 1,
        role_id: action.role_id,
        action,
        timestamp: new Date().toISOString(),
        description: this.generateActionDescription(action),
      };

      // Update state
      const updateResult = await this.stateManager.updateRoomState(roomId, (state) => {
        // Check if game is finished
        const isTerminal = gameLogic.isTerminal(actionResult.nextState);
        
        // Return a new object to avoid mutating the original state
        return {
          ...state,
          game_state: actionResult.nextState,
          history: [...state.history, historyEvent],
          room_status: isTerminal ? 'paused' : state.room_status,
          resume_locked: isTerminal ? true : state.resume_locked,
        };
      });

      if (!updateResult.success) {
        logger.error({ roomId, action, error: updateResult.error }, 'Failed to update room state after action');
        return {
          success: false,
          error: '状态更新失败',
          errorCode: updateResult.error,
        };
      }

      logger.info(
        {
          roomId,
          action: action.action_id,
          roleId: action.role_id,
          turn: historyEvent.turn,
        },
        'Action processed successfully'
      );

      return { success: true };
    } catch (error) {
      logger.error({ error, roomId, action }, 'Unexpected error processing action');
      return {
        success: false,
        error: '处理行动时发生错误',
        errorCode: 'INTERNAL_ERROR',
      };
    }
  }

  /**
   * Acquire distributed lock using Redis
   */
  private async acquireLock(key: string, value: string): Promise<boolean> {
    try {
      const result = await this.fastify.redis.set(
        key,
        value,
        'EX',
        this.LOCK_TTL,
        'NX'
      );
      return result === 'OK';
    } catch (error) {
      logger.error({ error, key }, 'Failed to acquire lock');
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  private async releaseLock(key: string, value: string): Promise<void> {
    try {
      // Use Lua script to ensure we only delete our lock
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      await this.fastify.redis.eval(script, 1, key, value);
    } catch (error) {
      logger.error({ error, key }, 'Failed to release lock');
    }
  }

  /**
   * Generate natural language description for action
   */
  private generateActionDescription(action: Action): string {
    if (action.params && Object.keys(action.params).length > 0) {
      const paramsStr = Object.entries(action.params)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      return `${action.role_id} 执行 ${action.action_id}(${paramsStr})`;
    }

    return `${action.role_id} 执行 ${action.action_id}`;
  }

  /**
   * Get lock key for room
   */
  private getLockKey(roomId: string): string {
    return `${this.LOCK_KEY_PREFIX}${roomId}`;
  }
}

/**
 * Factory function to create ActionProcessor instance
 */
export function createActionProcessor(
  fastify: FastifyInstance,
  stateManager: StateManager
): ActionProcessor {
  return new ActionProcessor(fastify, stateManager);
}

