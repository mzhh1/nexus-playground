/**
 * Auto Player Coordinator
 *
 * Orchestrates automatic player execution across all types of auto players.
 * Maintains a registry of auto player executors and triggers them when needed.
 *
 * NOTE: SSE broadcasting has been removed. State updates are now handled
 * by the Engine DO's WebSocket broadcasting.
 */

import { FastifyInstance } from 'fastify';
import { AutoPlayerExecutor } from './auto-player-executor.js';
import { createLLMPlayerExecutor } from './llm-player-executor.js';
import { createStateManager } from './state-manager.js';
import { getGameLogic } from '../games/registry.js';
import logger from '../utils/logger.js';

export class AutoPlayerCoordinator {
  private stateManager;
  private executors: AutoPlayerExecutor[] = [];

  constructor(private fastify: FastifyInstance) {
    this.stateManager = createStateManager(fastify);
    this.registerDefaultExecutors();
  }

  private registerDefaultExecutors(): void {
    this.registerExecutor(createLLMPlayerExecutor(this.fastify));
    logger.info(
      { executorCount: this.executors.length },
      'AutoPlayerCoordinator: Default executors registered'
    );
  }

  public registerExecutor(executor: AutoPlayerExecutor): void {
    this.executors.push(executor);
    logger.info(
      { executorName: executor.getName() },
      'AutoPlayerCoordinator: Executor registered'
    );
  }

  async checkAndExecuteCurrentTurn(roomId: string): Promise<void> {
    try {
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
        logger.debug({ roomId }, 'AutoPlayerCoordinator: Game not initialized');
        return;
      }

      const gameLogic = getGameLogic(roomState.game_id);
      if (await gameLogic.isTerminal(roomState.game_state)) {
        logger.info({ roomId }, 'AutoPlayerCoordinator: Game has ended');
        return;
      }

      const currentRole = await gameLogic.getCurrentRole(roomState.game_state);
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
        { roomId, roleId: currentRole, playerId, playerType: player.type },
        'AutoPlayerCoordinator: Checking current turn'
      );

      let executed = false;
      for (const executor of this.executors) {
        if (executor.canHandle(roomState, currentRole)) {
          logger.info(
            { roomId, roleId: currentRole, executorName: executor.getName() },
            'AutoPlayerCoordinator: Auto player turn detected, triggering executor'
          );

          executed = await executor.executeTurn(roomId, currentRole);

          if (executed) {
            logger.info(
              { roomId, roleId: currentRole, executorName: executor.getName() },
              'AutoPlayerCoordinator: Turn executed successfully'
            );

            // Recursively check next turn (with a small delay to avoid tight loops)
            await this.sleep(100);
            await this.checkAndExecuteCurrentTurn(roomId);

            return;
          } else {
            logger.warn(
              { roomId, roleId: currentRole, executorName: executor.getName() },
              'AutoPlayerCoordinator: Executor failed to execute turn'
            );
          }
        }
      }

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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public getRegisteredExecutors(): string[] {
    return this.executors.map((e) => e.getName());
  }
}

export function createAutoPlayerCoordinator(
  fastify: FastifyInstance
): AutoPlayerCoordinator {
  return new AutoPlayerCoordinator(fastify);
}
