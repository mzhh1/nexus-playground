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
import { randomUUID } from 'node:crypto';
import { createLLMLogDAO, LLMLogDAO } from '../db/llm-logs.js';

export class LLMPlayerExecutor implements AutoPlayerExecutor {
  private stateManager;
  private actionProcessor;
  private perspectiveGenerator;
  private llmLogDAO: LLMLogDAO;

  constructor(private fastify: FastifyInstance) {
    this.stateManager = createStateManager(fastify);
    this.actionProcessor = createActionProcessor(fastify, this.stateManager);
    this.perspectiveGenerator = createPerspectiveGenerator(
      fastify,
      this.stateManager
    );
    this.llmLogDAO = createLLMLogDAO(fastify);
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
   * Execute LLM player turn with unified retry logic
   * Handles all error types: API failures, parsing errors, validation failures, and game logic rejections
   */
  async executeTurn(roomId: string, currentRoleId: string): Promise<boolean> {
    const maxAttempts = 3;

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
      logger.debug({ llmPlayer }, 'LLMPlayerExecutor: LLM player');
      if (!llmPlayer || llmPlayer.type !== 'llm') {
        logger.warn(
          { roomId, roleId: currentRoleId, playerId },
          'LLMPlayerExecutor: Player is not an LLM player'
        );
        return false;
      }

      // 2. Check if game enables LLM memory
      const gameLogic = getGameLogic(roomState.game_id!);
      const metadata = await gameLogic.getMetadata();
      const memoryEnabled = metadata.enable_llm_memory === true;
      const currentMemory = memoryEnabled ? (llmPlayer.memory || '') : null;

      logger.debug(
        { roomId, playerId, memoryEnabled, hasMemory: !!currentMemory },
        'LLMPlayerExecutor: Memory status'
      );

      // 2.5. Generate perspective to check action space
      const checkPerspective = await this.perspectiveGenerator.generatePerspective(
        roomId,
        currentRoleId,
        { skipCache: true }
      );

      if (!checkPerspective) {
        logger.error(
          { roomId, roleId: currentRoleId },
          'LLMPlayerExecutor: Failed to generate perspective for action space check'
        );
        return false;
      }

      // 2.6. Check if action list is empty
      const hasActions = checkPerspective.action_space_definition.actions.length > 0;

      if (!hasActions) {
        logger.info(
          { roomId, roleId: currentRoleId, memoryEnabled },
          'LLMPlayerExecutor: Action list is empty'
        );

        // If memory is not enabled, skip turn (no LLM call needed)
        if (!memoryEnabled) {
          logger.info(
            { roomId, roleId: currentRoleId },
            'LLMPlayerExecutor: Memory not enabled, skipping turn (no action or memory update needed)'
          );
          return true; // Successfully handled empty action list
        }

        // If memory is enabled, call LLM to update memory only
        logger.info(
          { roomId, roleId: currentRoleId },
          'LLMPlayerExecutor: Memory enabled, calling LLM for memory update only'
        );

        const interactionGroupId = randomUUID();
        const llmExecutor = createLLMExecutor(this.fastify);

        const result = await llmExecutor.executeMemoryUpdate(
          roomId,
          currentRoleId,
          roomState.game_id || null,
          interactionGroupId,
          checkPerspective,
          llmPlayer.model_name || 'gpt-4.1',
          llmPlayer.system_prompt || '你是一个聪明的游戏玩家',
          llmPlayer.temperature ?? 0.7,
          currentMemory || ''
        );

        if (result && result.memory_update) {
          // Apply memory update
          const updatedMemory = this.applyMemoryUpdate(
            currentMemory || '',
            result.memory_update
          );

          // Update player memory in room state
          const freshRoomState = await this.stateManager.getRoomState(roomId);
          if (freshRoomState) {
            const freshLLMPlayer = freshRoomState.player_list[playerId] as LLMPlayer;
            const updatedPlayer: LLMPlayer = {
              ...freshLLMPlayer,
              memory: updatedMemory,
            };

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
                'LLMPlayerExecutor: Updated LLM player memory (no action executed)'
              );
            } else {
              logger.warn(
                { roomId, playerId, error: updateResult.error },
                'LLMPlayerExecutor: Failed to update LLM player memory'
              );
            }
          }

          return true; // Successfully updated memory
        } else {
          logger.warn(
            { roomId, roleId: currentRoleId },
            'LLMPlayerExecutor: Failed to get memory update from LLM'
          );
          // Even if memory update fails, we still return true because there was no action to execute
          return true;
        }
      }

      // 3. If action list is not empty, proceed with normal action execution
      logger.debug(
        { roomId, roleId: currentRoleId, actionCount: hasActions ? checkPerspective.action_space_definition.actions.length : 0 },
        'LLMPlayerExecutor: Action list not empty, proceeding with action execution'
      );

      const interactionGroupId = randomUUID();

      // 4. Unified retry loop for all error types
      let previousError: string | undefined;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        logger.info(
          { roomId, roleId: currentRoleId, attempt, maxAttempts },
          `LLMPlayerExecutor: Attempt ${attempt}/${maxAttempts}`
        );

        // 4.1. Generate fresh perspective (includes latest game state)
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
          previousError = 'Failed to generate game perspective';
          if (attempt === maxAttempts) {
            return false;
          }
          // Exponential backoff before retry
          const backoffMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1s, 2s
          await this.sleep(backoffMs);
          continue;
        }

        // 4.2. Execute LLM decision (single attempt, with memory and error feedback if retry)
        const llmExecutor = createLLMExecutor(this.fastify);
        const result = await llmExecutor.executeDecision(
          roomId,
          currentRoleId,
          roomState.game_id || null,
          interactionGroupId,
          attempt,
          maxAttempts,
          perspective,
          llmPlayer.model_name || 'gpt-4o-mini-2024-07-18',
          llmPlayer.system_prompt || '你是一个聪明的游戏玩家',
          llmPlayer.temperature ?? 0.7,
          currentMemory, // Pass current memory (null if not enabled)
          previousError   // Pass previous error for retry attempts
        );

        // Check if result contains an error
        if ('error' in result) {
          logger.warn(
            { roomId, roleId: currentRoleId, attempt, error: result.error },
            'LLMPlayerExecutor: LLM failed to generate valid action (API/parsing/validation error)'
          );
          previousError = result.error;
          if (attempt === maxAttempts) {
            logger.error(
              { roomId, roleId: currentRoleId },
              'LLMPlayerExecutor: All retry attempts exhausted'
            );
            return false;
          }
          // Exponential backoff before retry
          const backoffMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1s, 2s
          await this.sleep(backoffMs);
          continue;
        }

        // 4.3. Submit action to game logic
        logger.info(
          { roomId, roleId: currentRoleId, action: result.action, attempt },
          'LLMPlayerExecutor: Submitting LLM-generated action'
        );

        const actionResult = await this.actionProcessor.processAction(roomId, result.action);

        if (!actionResult.success) {
          logger.warn(
            { roomId, roleId: currentRoleId, action: result.action, error: actionResult.error, attempt },
            'LLMPlayerExecutor: Action rejected by game logic'
          );

          // Store error message for next retry
          previousError = actionResult.error || '行动无效';

          if (result.logId) {
            try {
              await this.llmLogDAO.updateInteraction(result.logId, {
                status: 'rejected',
                errorMessage: previousError,
                previousError,
              });
            } catch (error) {
              logger.error(
                { error, roomId, roleId: currentRoleId, logId: result.logId },
                'LLMPlayerExecutor: Failed to update LLM interaction log after rejection'
              );
            }
          }

          if (attempt === maxAttempts) {
            logger.error(
              { roomId, roleId: currentRoleId, action: result.action, error: actionResult.error },
              'LLMPlayerExecutor: All retry attempts exhausted'
            );
            return false;
          }

          // Exponential backoff before retry
          const backoffMs = Math.pow(2, attempt - 1) * 500; // 500ms, 1s, 2s
          await this.sleep(backoffMs);
          continue;
        }

        // 4.4. Update LLM player memory if memory update is provided
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

        // 4.5. Success!
        logger.info(
          { roomId, roleId: currentRoleId, attempt, totalAttempts: attempt },
          'LLMPlayerExecutor: LLM turn executed successfully'
        );

        return true;
      }

      // All attempts exhausted
      logger.error(
        { roomId, roleId: currentRoleId, maxAttempts },
        'LLMPlayerExecutor: All retry attempts exhausted without success'
      );
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

