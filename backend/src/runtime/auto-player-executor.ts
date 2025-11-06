/**
 * Auto Player Executor Interface
 * 
 * Defines the contract for automatic player executors.
 * Any type of auto player (LLM, Rule-based AI, RL Agent, etc.) 
 * can implement this interface to participate in the auto-play system.
 */

import { FastifyInstance } from 'fastify';
import { RoomState } from '../games/types.js';

/**
 * Auto Player Executor Interface
 * 
 * Implementations should:
 * 1. Check if they can handle the current player
 * 2. Execute the player's turn if applicable
 * 3. Return true if executed, false if not applicable
 */
export interface AutoPlayerExecutor {
  /**
   * Get executor name (for logging and debugging)
   */
  getName(): string;

  /**
   * Check if this executor can handle the current turn's player
   * 
   * @param roomState Current room state
   * @param currentRoleId Current role that needs to act
   * @returns true if this executor can handle this player
   */
  canHandle(roomState: RoomState, currentRoleId: string): boolean;

  /**
   * Execute the player's turn
   * 
   * Should:
   * - Generate perspective
   * - Make decision
   * - Submit action via ActionProcessor
   * - Handle errors gracefully
   * 
   * @param roomId Room ID
   * @param currentRoleId Role ID that needs to act
   * @returns Promise<boolean> - true if execution succeeded, false otherwise
   */
  executeTurn(roomId: string, currentRoleId: string): Promise<boolean>;
}

/**
 * Factory type for creating auto player executors
 */
export type AutoPlayerExecutorFactory = (
  fastify: FastifyInstance
) => AutoPlayerExecutor;

