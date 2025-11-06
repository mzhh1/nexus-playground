/**
 * LLM Player Executor
 * 
 * Implements AutoPlayerExecutor for LLM-controlled players.
 * Handles LLM player turns by:
 * 1. Generating perspective
 * 2. Calling LLM API for decision
 * 3. Submitting action to game
 */

import { FastifyInstance } from 'fastify';
import { AutoPlayerExecutor } from './auto-player-executor.js';
import { RoomState, LLMPlayer } from '../games/types.js';
import { createStateManager } from './state-manager.js';
import { createActionProcessor } from './action-processor.js';
import { createPerspectiveGenerator } from './perspective-generator.js';
import { createLLMExecutor } from './llm-executor.js';
import { getGameLogic } from '../games/registry.js';
import logger from '../utils/logger.js';

export class LLMPlayerExecutor implements AutoPlayerExecutor {
  private stateManager;
  private actionProcessor;
  private perspectiveGenerator;

  constructor(private fastify: FastifyInstance) {
    this.stateManager = createStateManager(fastify);
    this.actionProcessor = createActionProcessor(fastify, this.stateManager);
    this.perspectiveGenerator = createPerspectiveGenerator(
      fastify,
      this.stateManager
    );
  }

  getName(): string {
    return 'LLMPlayerExecutor';
  }

  /**
   * Check if current player is an LLM player
   */
  canHandle(roomState: RoomState, currentRoleId: string): boolean {
    const playerId = roomState.role_mapping[currentRoleId];
    if (!playerId) {
      return false;
    }

    const player = roomState.player_list[playerId];
    return player?.type === 'llm';
  }

  /**
   * Execute LLM player turn with retry logic for game logic rejections
   */
  async executeTurn(roomId: string, currentRoleId: string): Promise<boolean> {
    const maxRetries = 3;

    try {
      logger.info(
        { roomId, roleId: currentRoleId },
        'LLMPlayerExecutor: Starting LLM turn execution'
      );

      // 1. Get room state and player info
      const roomState = await this.stateManager.getRoomState(roomId);
      if (!roomState) {
        logger.error({ roomId }, 'LLMPlayerExecutor: Room state not found');
        return false;
      }

      const playerId = roomState.role_mapping[currentRoleId];
      const llmPlayer = roomState.player_list[playerId];
      logger.debug({llmPlayer}, 'LLMPlayerExecutor: LLM player');
      if (!llmPlayer || llmPlayer.type !== 'llm') {
        logger.warn(
          { roomId, roleId: currentRoleId, playerId },
          'LLMPlayerExecutor: Player is not an LLM player'
        );
        return false;
      }

      // 2. Check if game enables LLM memory
      const gameLogic = getGameLogic(roomState.game_id!);
      const metadata = gameLogic.getMetadata();
      const memoryEnabled = metadata.enable_llm_memory === true;
      const currentMemory = memoryEnabled ? (llmPlayer.memory || '') : null;

      logger.debug(
        { roomId, playerId, memoryEnabled, hasMemory: !!currentMemory },
        'LLMPlayerExecutor: Memory status'
      );

      // 3. Retry loop for handling game logic rejections
      let previousError: string | undefined;
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        logger.info(
          { roomId, roleId: currentRoleId, attempt, maxRetries },
          `LLMPlayerExecutor: Attempt ${attempt}/${maxRetries}`
        );

        // 2.1. Generate fresh perspective (includes latest game state)
        const perspective = await this.perspectiveGenerator.generatePerspective(
          roomId,
          currentRoleId,
          { skipCache: true } // Always get fresh state for retries
        );

        if (!perspective) {
          logger.error(
            { roomId, roleId: currentRoleId, attempt },
            'LLMPlayerExecutor: Failed to generate perspective'
          );
          if (attempt === maxRetries) {
            return false;
          }
          continue;
        }

        // 2.2. Execute LLM decision (with memory and error feedback if retry)
        const llmExecutor = createLLMExecutor(this.fastify);
        const result = await llmExecutor.executeDecision(
          roomId,
          currentRoleId,
          perspective,
          llmPlayer.model_name || 'gpt-4o-mini-2024-07-18',
          llmPlayer.system_prompt || '你是一个聪明的游戏玩家',
          currentMemory, // Pass current memory (null if not enabled)
          previousError   // Pass previous error for retry attempts
        );

        if (!result || !result.action) {
          logger.error(
            { roomId, roleId: currentRoleId, attempt },
            'LLMPlayerExecutor: LLM failed to generate valid action'
          );
          if (attempt === maxRetries) {
            // TODO: Consider pausing game and notifying room owner
            return false;
          }
          continue;
        }

        // 2.3. Submit action to game logic
        logger.info(
          { roomId, roleId: currentRoleId, action: result.action, attempt },
          'LLMPlayerExecutor: Submitting LLM-generated action'
        );

        const actionResult = await this.actionProcessor.processAction(roomId, result.action);

        if (!actionResult.success) {
          logger.warn(
            { roomId, roleId: currentRoleId, action: result.action, error: actionResult.error, attempt },
            'LLMPlayerExecutor: Action was rejected by game logic'
          );
          
          // Store error message for next retry
          previousError = actionResult.error || '行动无效';
          
          if (attempt === maxRetries) {
            logger.error(
              { roomId, roleId: currentRoleId, action: result.action, error: actionResult.error },
              'LLMPlayerExecutor: All retry attempts exhausted, action still rejected'
            );
            return false;
          }
          
          // Exponential backoff before retry
          const backoffMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1s, 2s
          await this.sleep(backoffMs);
          continue;
        }

        // 2.4. Update LLM player memory if memory update is provided
        if (memoryEnabled && result.memory_update) {
          const updatedMemory = this.applyMemoryUpdate(
            currentMemory || '',
            result.memory_update
          );

          // Get fresh room state to update player
          const freshRoomState = await this.stateManager.getRoomState(roomId);
          if (freshRoomState) {
            const freshLLMPlayer = freshRoomState.player_list[playerId] as LLMPlayer;
            const updatedPlayer: LLMPlayer = {
              ...freshLLMPlayer,
              memory: updatedMemory,
            };

            // Update player in room state
            const updateResult = await this.stateManager.updateRoomState(roomId, (state) => ({
              ...state,
              player_list: {
                ...state.player_list,
                [playerId]: updatedPlayer,
              },
            }));

            if (updateResult.success) {
              logger.info(
                { roomId, playerId, updateMode: result.memory_update.mode, memoryLength: updatedMemory.length },
                'LLMPlayerExecutor: Updated LLM player memory'
              );
            } else {
              logger.warn(
                { roomId, playerId, error: updateResult.error },
                'LLMPlayerExecutor: Failed to update LLM player memory'
              );
            }
          }
        }

        // 2.5. Success!
        logger.info(
          { roomId, roleId: currentRoleId, attempt },
          'LLMPlayerExecutor: LLM turn executed successfully'
        );

        return true;
      }

      // Should not reach here, but just in case
      return false;

    } catch (error) {
      logger.error(
        { error, roomId, roleId: currentRoleId },
        'LLMPlayerExecutor: Unexpected error during turn execution'
      );
      return false;
    }
  }

  /**
   * Apply memory update based on mode (append or replace)
   * Each LLM player has independent memory
   */
  private applyMemoryUpdate(
    currentMemory: string,
    update: { mode: 'append' | 'replace'; content: string }
  ): string {
    if (update.mode === 'replace') {
      return update.content;
    } else {
      // append mode
      return currentMemory 
        ? `${currentMemory}\n${update.content}` 
        : update.content;
    }
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create LLM player executor
 */
export function createLLMPlayerExecutor(
  fastify: FastifyInstance
): LLMPlayerExecutor {
  return new LLMPlayerExecutor(fastify);
}

