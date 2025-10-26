/**
 * LLM Executor (Placeholder for M0)
 * Will be fully implemented in M2
 */

import { FastifyInstance } from 'fastify';
import { RolePerspective, Action } from '../games/types';
import logger from '../utils/logger';

/**
 * LLM Executor
 * Handles LLM player decision making
 * 
 * M0 Note: This is a placeholder. Full implementation will be added in M2
 * when LLM players are enabled.
 */
export class LLMExecutor {
  // @ts-expect-error - Will be used in M2 implementation
  constructor(private _fastify: FastifyInstance) {}

  /**
   * Execute LLM decision for a role
   * 
   * @param roomId Room ID
   * @param roleId Role ID
   * @param perspective Role perspective
   * @param modelName LLM model name (e.g., "gpt-4o-mini")
   * @param systemPrompt System prompt for the LLM
   * @returns Selected action or null if execution fails
   */
  async executeDecision(
    roomId: string,
    roleId: string,
    _perspective: RolePerspective,
    modelName: string,
    _systemPrompt: string
  ): Promise<Action | null> {
    // M0: Placeholder implementation
    // In M2, this will:
    // 1. Format perspective into LLM prompt
    // 2. Call LLM API (via @autolabz/llmapi-sdk)
    // 3. Parse LLM response to extract action
    // 4. Validate action against action_space_definition
    // 5. Return structured Action object

    logger.warn(
      { roomId, roleId, modelName },
      'LLM executor called but not implemented in M0'
    );

    return null;
  }

  /**
   * Format perspective into LLM prompt
   * (Placeholder for M2)
   */
  // @ts-expect-error - Placeholder for M2 implementation
  private formatPrompt(
    _perspective: RolePerspective,
    _systemPrompt: string
  ): string {
    // M2: Will construct a detailed prompt including:
    // - Game rules
    // - Current state
    // - History
    // - Available actions
    // - Role objective

    return '';
  }

  /**
   * Parse LLM response to extract action
   * (Placeholder for M2)
   */
  // @ts-expect-error - Placeholder for M2 implementation
  private parseResponse(
    _response: string,
    _perspective: RolePerspective
  ): Action | null {
    // M2: Will parse LLM output (likely JSON format) and validate
    // against available actions in perspective.action_space_definition

    return null;
  }

  /**
   * Validate action against action space
   * (Placeholder for M2)
   */
  // @ts-expect-error - Placeholder for M2 implementation
  private validateAction(
    _action: Action,
    _perspective: RolePerspective
  ): boolean {
    // M2: Will check if action is in the legal action space

    return false;
  }
}

/**
 * Factory function to create LLMExecutor instance
 */
export function createLLMExecutor(fastify: FastifyInstance): LLMExecutor {
  return new LLMExecutor(fastify);
}

