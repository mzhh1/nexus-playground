/**
 * Auto Player Coordinator
 * 
 * Orchestrates automatic player execution across all types of auto players.
 * Maintains a registry of auto player executors and triggers them when needed.
 * 
 * Design:
 * - Registry pattern: Multiple executor implementations can be registered
 * - Chain of responsibility: First matching executor handles the turn
 * - Recursive handling: Supports consecutive auto player turns
 * - Centralized coordination: Single point for all auto-play logic
 */

import { FastifyInstance } from 'fastify';
import { AutoPlayerExecutor } from './auto-player-executor.js';
import { createLLMPlayerExecutor } from './llm-player-executor.js';
import { createStateManager } from './state-manager.js';
import { createPerspectiveGenerator } from './perspective-generator.js';
import { getEventBus } from './event-bus.js';
import { getGameLogic } from '../games/registry.js';
import logger from '../utils/logger.js';
import { broadcastPerspectivesToAllPlayers } from '../utils/perspective-broadcast.js';

export class AutoPlayerCoordinator {
  private stateManager;
  private perspectiveGenerator;
  private eventBus;
  private executors: AutoPlayerExecutor[] = [];

  constructor(private fastify: FastifyInstance) {
    this.stateManager = createStateManager(fastify);
    this.perspectiveGenerator = createPerspectiveGenerator(
      fastify,
      this.stateManager
    );
    this.eventBus = getEventBus();

    // Register default executors
    this.registerDefaultExecutors();
  }

  /**
   * Register default auto player executors
   * 
   * Future executors can be added here:
   * - Rule-based AI
   * - Reinforcement Learning agents
   * - Monte Carlo Tree Search
   * - etc.
   */
  private registerDefaultExecutors(): void {
    // Register LLM player executor
    this.registerExecutor(createLLMPlayerExecutor(this.fastify));

    logger.info(
      { executorCount: this.executors.length },
      'AutoPlayerCoordinator: Default executors registered'
    );
  }

  /**
   * Register a custom auto player executor
   * 
   * @param executor Auto player executor instance
   */
  public registerExecutor(executor: AutoPlayerExecutor): void {
    this.executors.push(executor);
    logger.info(
      { executorName: executor.getName() },
      'AutoPlayerCoordinator: Executor registered'
    );
  }

  /**
   * Check and execute auto player turn for current role
   * 
   * This is the main entry point for triggering auto-play.
   * Call this after:
   * 1. Game starts (to handle initial auto player)
   * 2. Any action completes (to handle next auto player)
   * 
   * Features:
   * - Validates game state
   * - Checks for game termination
   * - Finds matching executor
   * - Handles recursive auto-play (for consecutive auto players)
   * - Broadcasts perspective updates
   * 
   * @param roomId Room ID
   */
  async checkAndExecuteCurrentTurn(roomId: string): Promise<void> {
    try {
      // 1. Get and validate room state
      const roomState = await this.stateManager.getRoomState(roomId);

      if (!roomState) {
        logger.debug({ roomId }, 'AutoPlayerCoordinator: Room not found');
        return;
      }

      if (roomState.room_status !== 'playing') {
        logger.debug(
          { roomId, status: roomState.room_status },
          'AutoPlayerCoordinator: Game not in playing state'
        );
        return;
      }

      if (!roomState.game_state || !roomState.game_id) {
        logger.debug(
          { roomId },
          'AutoPlayerCoordinator: Game not initialized'
        );
        return;
      }

      // 2. Check if game has ended
      const gameLogic = getGameLogic(roomState.game_id);
      if (gameLogic.isTerminal(roomState.game_state)) {
        logger.info({ roomId }, 'AutoPlayerCoordinator: Game has ended');
        return;
      }

      // 3. Get current role
      const currentRole = gameLogic.getCurrentRole(roomState.game_state);
      const playerId = roomState.role_mapping[currentRole];

      if (!playerId) {
        logger.warn(
          { roomId, roleId: currentRole },
          'AutoPlayerCoordinator: Current role not mapped to any player'
        );
        return;
      }

      const player = roomState.player_list[playerId];
      if (!player) {
        logger.warn(
          { roomId, roleId: currentRole, playerId },
          'AutoPlayerCoordinator: Player not found'
        );
        return;
      }

      logger.debug(
        {
          roomId,
          roleId: currentRole,
          playerId,
          playerType: player.type,
        },
        'AutoPlayerCoordinator: Checking current turn'
      );

      // 4. Find matching executor (chain of responsibility pattern)
      let executed = false;
      for (const executor of this.executors) {
        if (executor.canHandle(roomState, currentRole)) {
          logger.info(
            {
              roomId,
              roleId: currentRole,
              executorName: executor.getName(),
            },
            'AutoPlayerCoordinator: Auto player turn detected, triggering executor'
          );

          // Execute the turn
          executed = await executor.executeTurn(roomId, currentRole);

          if (executed) {
            logger.info(
              {
                roomId,
                roleId: currentRole,
                executorName: executor.getName(),
              },
              'AutoPlayerCoordinator: Turn executed successfully'
            );

            // 5. Invalidate and regenerate perspectives
            await this.perspectiveGenerator.invalidateAllPerspectives(roomId);

            // Broadcast updated perspectives to all players (including spectators)
            await broadcastPerspectivesToAllPlayers(
              roomId,
              this.stateManager,
              this.perspectiveGenerator,
              this.eventBus
            );

            // 6. Recursively check next turn (with a small delay to avoid tight loops)
            await this.sleep(100);
            await this.checkAndExecuteCurrentTurn(roomId);

            return; // Exit after successful execution
          } else {
            logger.warn(
              {
                roomId,
                roleId: currentRole,
                executorName: executor.getName(),
              },
              'AutoPlayerCoordinator: Executor failed to execute turn'
            );
            // Try next executor (though typically only one should match)
          }
        }
      }

      // 7. No executor matched - waiting for human player
      if (!executed) {
        logger.debug(
          { roomId, roleId: currentRole, playerType: player.type },
          'AutoPlayerCoordinator: No auto executor matched, waiting for human player'
        );
      }
    } catch (error) {
      logger.error(
        { error, roomId },
        'AutoPlayerCoordinator: Error in checkAndExecuteCurrentTurn'
      );
    }
  }

  /**
   * Sleep utility for recursive turn handling
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get list of registered executor names (for debugging/monitoring)
   */
  public getRegisteredExecutors(): string[] {
    return this.executors.map((e) => e.getName());
  }
}

/**
 * Factory function to create auto player coordinator
 */
export function createAutoPlayerCoordinator(
  fastify: FastifyInstance
): AutoPlayerCoordinator {
  return new AutoPlayerCoordinator(fastify);
}

