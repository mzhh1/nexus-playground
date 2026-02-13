/**
 * LLM Executor
 * Handles LLM player decision making using non-streaming API
 */

import { FastifyInstance } from 'fastify';
import { RolePerspective, Action } from '../games/types.js';
import logger from '../utils/logger.js';
import { createLLMLogDAO, LLMLogDAO } from '../db/llm-logs.js';
import { TASK_PROMPT_NO_MEMORY, TASK_PROMPT_WITH_MEMORY, NO_TASK_PROMPT_WITH_MEMORY } from './task-prompts.js';
import { getGameLogic } from '../games/registry.js';

/**
 * LLM response format (structured JSON)
 */
interface LLMActionResponse {
  reasoning?: string; // Optional: LLM's reasoning for debugging
  action_id: string;
  params?: Record<string, any>;

  /**
   * Memory update (only used when game enables LLM memory)
   */
  memory_update?: {
    mode: 'append' | 'replace'; // append: add to existing memory, replace: overwrite
    content: string;             // new memory content
  };
}

/**
 * LLM Executor
 * Handles LLM player decision making (single execution, no internal retry)
 */
export class LLMExecutor {
  private llmLogDAO: LLMLogDAO;

  constructor(private fastify: FastifyInstance) {
    this.llmLogDAO = createLLMLogDAO(fastify);
  }

  /**
   * Execute LLM decision for a role (non-streaming, single attempt)
   * 
   * @param roomId Room ID
   * @param roleId Role ID
   * @param gameId Game ID
   * @param interactionGroupId Interaction group ID for logging
   * @param attempt Current attempt number (for logging)
   * @param maxAttempts Maximum attempts (for logging)
   * @param perspective Role perspective
   * @param modelName LLM model name (e.g., "gpt-4o-mini-2024-07-18")
   * @param systemPrompt System prompt for the LLM
   * @param temperature Temperature parameter for LLM (controls randomness)
   * @param currentMemory Current memory state (null if memory not enabled)
   * @param previousError Optional error message from previous failed attempt
   * @returns Action and optional memory update with logId, or { error: string, logId?: string } if execution fails
   */
  async executeDecision(
    roomId: string,
    roleId: string,
    gameId: string | null,
    interactionGroupId: string,
    attempt: number,
    maxAttempts: number,
    perspective: RolePerspective,
    modelName: string,
    systemPrompt: string,
    temperature: number,
    currentMemory: string | null,
    previousError?: string
  ): Promise<{
    action: Action;
    memory_update?: { mode: 'append' | 'replace'; content: string };
    logId: string;
  } | { error: string; logId?: string }> {
    logger.info(
      { roomId, roleId, modelName, attempt, maxAttempts },
      'LLM executor: Starting decision execution'
    );

    let interactionId: string | null = null;
    let startAt = Date.now();

    try {
      // 1. Format perspective into LLM prompt (with memory if enabled)
      const userPrompt = this.formatPrompt(gameId, perspective, currentMemory, previousError);

      const createdLog = await this.llmLogDAO.createInteraction({
        interactionGroupId,
        roomId,
        gameId,
        roleId,
        modelName,
        systemPrompt,
        userPrompt,
        attempt,
        outerAttempt: attempt,
        maxAttempts,
        status: 'pending',
        previousError: previousError ?? null,
      });
      interactionId = createdLog.interaction_id;
      if (!interactionId) {
        throw new Error('Failed to create LLM interaction log entry');
      }
      startAt = Date.now();

      // 2. Call LLM API (non-streaming)
      const llmClient = this.fastify.appAuth.llmClient;

      logger.debug(
        { roomId, roleId, promptLength: userPrompt.length },
        'LLM executor: Calling LLM API'
      );
      logger.debug({ systemPrompt, userPrompt }, 'LLM executor: User prompt');
      const content = await llmClient.getChatContent({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        // Note: response_format is not supported by all LLM SDK versions
        // Rely on prompt engineering to ensure JSON output
      });

      logger.debug(
        { roomId, roleId, responseLength: content.length },
        'LLM executor: Received LLM response'
      );

      // 3. Parse LLM response to extract action and memory update
      const parsed = this.parseResponse(content, perspective, roleId);
      const responseTimeMs = Date.now() - startAt;

      if (!parsed || !parsed.action) {
        const errorMsg = 'LLM返回的JSON格式错误或缺少action_id字段';
        logger.warn(
          { roomId, roleId, attempt, response: content },
          'LLM executor: Failed to parse valid action from LLM response'
        );

        await this.llmLogDAO.updateInteraction(interactionId, {
          status: 'failed',
          response: content,
          errorMessage: errorMsg,
          responseTimeMs,
        });

        return { error: errorMsg, logId: interactionId };
      }

      // 4. Validate action against action space
      const validationResult = this.validateAction(parsed.action, perspective);
      if (!validationResult.valid) {
        logger.warn(
          { roomId, roleId, attempt, action: parsed.action, error: validationResult.error },
          'LLM executor: Action validation failed'
        );

        await this.llmLogDAO.updateInteraction(interactionId, {
          status: 'failed',
          response: content,
          errorMessage: validationResult.error || 'Generated action did not pass validation',
          responseTimeMs,
        });

        return { error: validationResult.error || 'Generated action did not pass validation', logId: interactionId };
      }

      logger.info(
        { roomId, roleId, action: parsed.action, hasMemoryUpdate: !!parsed.memory_update },
        'LLM executor: Successfully generated valid action'
      );

      await this.llmLogDAO.updateInteraction(interactionId, {
        status: 'success',
        response: content,
        errorMessage: null,
        responseTimeMs,
      });

      return {
        action: parsed.action,
        memory_update: parsed.memory_update,
        logId: interactionId,
      };

    } catch (error) {
      logger.error(
        { roomId, roleId, attempt, error },
        'LLM executor: Error during execution'
      );

      const responseTimeMs = Date.now() - startAt;
      const normalizedError =
        error instanceof Error ? error.message : String(error);
      const errorMsg = `LLM API调用失败：${normalizedError}`;

      if (interactionId) {
        try {
          await this.llmLogDAO.updateInteraction(interactionId, {
            status: 'failed',
            response: null,
            errorMessage: errorMsg,
            responseTimeMs,
          });
        } catch (updateError) {
          logger.error(
            { updateError, interactionId },
            'Failed to update LLM interaction log after error'
          );
        }
        return { error: errorMsg, logId: interactionId };
      } else {
        logger.error(
          { error, roomId, roleId, attempt },
          'LLM executor: Unable to record interaction error because log not created'
        );
        return { error: errorMsg };
      }
    }
  }

  /**
   * Execute memory update only (no action required)
   * Used when action list is empty but memory is enabled
   * 
   * @param roomId Room ID
   * @param roleId Role ID
   * @param gameId Game ID
   * @param interactionGroupId Interaction group ID for logging
   * @param perspective Role perspective
   * @param modelName LLM model name
   * @param systemPrompt System prompt for the LLM
   * @param temperature Temperature parameter for LLM (controls randomness)
   * @param currentMemory Current memory state
   * @returns Memory update or null if execution fails
   */
  async executeMemoryUpdate(
    roomId: string,
    roleId: string,
    gameId: string | null,
    interactionGroupId: string,
    perspective: RolePerspective,
    modelName: string,
    systemPrompt: string,
    temperature: number,
    currentMemory: string
  ): Promise<{
    memory_update?: { mode: 'append' | 'replace'; content: string };
    logId: string;
  } | null> {
    logger.info(
      { roomId, roleId, modelName },
      'LLM executor: Starting memory-only update (no action required)'
    );

    let interactionId: string | null = null;
    let startAt = Date.now();

    try {
      // 1. Format prompt for memory update only
      const userPrompt = this.formatMemoryOnlyPrompt(gameId, perspective, currentMemory);

      const createdLog = await this.llmLogDAO.createInteraction({
        interactionGroupId,
        roomId,
        gameId,
        roleId,
        modelName,
        systemPrompt,
        userPrompt,
        attempt: 1,
        outerAttempt: 1,
        maxAttempts: 1,
        status: 'pending',
        previousError: null,
      });
      interactionId = createdLog.interaction_id;
      if (!interactionId) {
        throw new Error('Failed to create LLM interaction log entry');
      }
      startAt = Date.now();

      // 2. Call LLM API
      const llmClient = this.fastify.appAuth.llmClient;

      logger.debug(
        { roomId, roleId, promptLength: userPrompt.length },
        'LLM executor: Calling LLM API for memory update only'
      );
      logger.debug({ systemPrompt, userPrompt }, 'LLM executor: User prompt for memory update');

      const content = await llmClient.getChatContent({
        model: modelName,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
      });

      logger.debug(
        { roomId, roleId, responseLength: content.length },
        'LLM executor: Received LLM response for memory update'
      );

      // 3. Parse response to extract memory update
      const parsed = this.parseMemoryOnlyResponse(content);
      const responseTimeMs = Date.now() - startAt;

      if (!parsed || !parsed.memory_update) {
        logger.warn(
          { roomId, roleId, response: content },
          'LLM executor: Failed to parse valid memory update from LLM response'
        );

        await this.llmLogDAO.updateInteraction(interactionId, {
          status: 'failed',
          response: content,
          errorMessage: 'Failed to parse valid memory update from LLM response',
          responseTimeMs,
        });

        return null;
      }

      logger.info(
        { roomId, roleId, updateMode: parsed.memory_update.mode },
        'LLM executor: Successfully generated memory update'
      );

      await this.llmLogDAO.updateInteraction(interactionId, {
        status: 'success',
        response: content,
        errorMessage: null,
        responseTimeMs,
      });

      return {
        memory_update: parsed.memory_update,
        logId: interactionId,
      };

    } catch (error) {
      logger.error(
        { roomId, roleId, error },
        'LLM executor: Error during memory update execution'
      );

      const responseTimeMs = Date.now() - startAt;
      const normalizedError =
        error instanceof Error ? error.message : String(error);

      if (interactionId) {
        try {
          await this.llmLogDAO.updateInteraction(interactionId, {
            status: 'failed',
            response: null,
            errorMessage: normalizedError,
            responseTimeMs,
          });
        } catch (updateError) {
          logger.error(
            { updateError, interactionId },
            'Failed to update LLM interaction log after error'
          );
        }
      }

      return null;
    }
  }

  /**
   * Format perspective into LLM prompt (memory update only, no action required)
   */
  private formatMemoryOnlyPrompt(
    gameId: string | null,
    perspective: RolePerspective,
    currentMemory: string
  ): string {
    // Get game logic instance to generate state prompt
    let statePrompt: string;
    if (gameId) {
      try {
        const gameLogic = getGameLogic(gameId);
        statePrompt = gameLogic.generateStatePrompt(perspective);
      } catch (error) {
        logger.error({ gameId, error }, 'Failed to get game logic or generate state prompt');
        throw error;
      }
    } else {
      logger.warn('No gameId provided to formatMemoryOnlyPrompt, using fallback');
      statePrompt = `# 当前游戏状态\n${JSON.stringify(perspective.current_state, null, 2)}`;
    }

    // Construct memory section
    const memorySection = `
# 🧠 你的记忆
以下是你在本局游戏中积累的个人记忆和推理笔记：

${currentMemory || '(暂无记忆)'}

---
`;

    return `${statePrompt}${memorySection}${NO_TASK_PROMPT_WITH_MEMORY}`;
  }

  /**
   * Parse LLM response for memory-only update
   * Expects JSON format: { reasoning?: string, memory_update: { mode, content } }
   */
  private parseMemoryOnlyResponse(
    response: string
  ): { memory_update?: { mode: 'append' | 'replace'; content: string } } | null {
    try {
      // Clean response: remove markdown code block markers if present
      let cleanedResponse = response.trim();

      const markdownMatch = cleanedResponse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
      if (markdownMatch) {
        cleanedResponse = markdownMatch[1].trim();
      }

      // Try to parse as JSON
      const parsed = JSON.parse(cleanedResponse) as {
        reasoning?: string;
        memory_update?: { mode: 'append' | 'replace'; content: string };
      };

      // Validate and extract memory_update
      if (
        parsed.memory_update &&
        parsed.memory_update.mode &&
        ['append', 'replace'].includes(parsed.memory_update.mode) &&
        parsed.memory_update.content &&
        typeof parsed.memory_update.content === 'string'
      ) {
        logger.debug(
          { mode: parsed.memory_update.mode, contentLength: parsed.memory_update.content.length },
          'LLM executor: Parsed memory-only update'
        );

        return {
          memory_update: {
            mode: parsed.memory_update.mode as 'append' | 'replace',
            content: parsed.memory_update.content,
          },
        };
      } else {
        logger.warn(
          { parsed },
          'LLM executor: Invalid or missing memory_update in response'
        );
        return null;
      }

    } catch (error) {
      logger.error(
        { error, response },
        'LLM executor: Failed to parse memory-only response as JSON'
      );
      return null;
    }
  }

  /**
   * Format perspective into LLM prompt
   * Constructs a detailed prompt with game rules, state, history, and available actions
   * 
   * @param gameId Game ID (to get game logic)
   * @param perspective Role perspective
   * @param currentMemory Current memory state (null if memory not enabled)
   * @param previousError Optional error message from previous failed attempt
   */
  private formatPrompt(gameId: string | null, perspective: RolePerspective, currentMemory: string | null, previousError?: string): string {
    const { action_space_definition } = perspective;

    // Get game logic instance to generate state prompt
    let statePrompt: string;
    if (gameId) {
      try {
        const gameLogic = getGameLogic(gameId);
        // Call game's custom state prompt generator
        statePrompt = gameLogic.generateStatePrompt(perspective);
      } catch (error) {
        logger.error({ gameId, error }, 'Failed to get game logic or generate state prompt');
        throw error;
      }
    } else {
      // Fallback: if no gameId (shouldn't happen in normal flow), generate basic prompt
      logger.warn('No gameId provided to formatPrompt, using fallback state prompt generation');
      statePrompt = `# 当前游戏状态\n${JSON.stringify(perspective.current_state, null, 2)}`;
    }

    // Format available actions (system-generated)
    const actionsText = action_space_definition.actions.map(a => {
      if (!a.params_schema || Object.keys(a.params_schema).length === 0) {
        // Fixed option action (no parameters)
        return `- action_id: "${a.action_id}"\n  描述: ${a.description}\n  参数: 无`;
      } else {
        // Parameterized action
        const paramsLines = Object.entries(a.params_schema)
          .map(([key, schema]) => {
            const s = schema as any;
            let line = `    * ${key} (${s.type}): ${s.description || ''}`;
            if (s.minimum !== undefined || s.maximum !== undefined) {
              line += ` [范围: ${s.minimum}-${s.maximum}]`;
            }
            if (s.enum) {
              line += ` [可选值: ${s.enum.join(', ')}]`;
            }
            return line;
          })
          .join('\n');
        return `- action_id: "${a.action_id}"\n  描述: ${a.description}\n  参数:\n${paramsLines}`;
      }
    }).join('\n\n');

    // Construct memory section if memory is enabled (system-generated)
    const memorySection = currentMemory !== null ? `
# 🧠 你的记忆
以下是你在本局游戏中积累的个人记忆和推理笔记：

${currentMemory || '(暂无记忆)'}

---
` : '';

    // Construct action prompt (system-generated)
    const actionPrompt = `
# 可用行动列表
${actionsText}
${previousError ? `
# ⚠️ 上次行动被拒绝
你上次选择的行动被游戏逻辑拒绝，原因：${previousError}
请重新分析当前局势，选择一个**合法且有效**的行动。`: ''}`;

    // Select task prompt based on whether memory is enabled (system-generated)
    const taskPrompt = currentMemory !== null
      ? TASK_PROMPT_WITH_MEMORY
      : TASK_PROMPT_NO_MEMORY;

    return `${statePrompt}${memorySection}${actionPrompt}${taskPrompt}`;
  }

  /**
   * Parse LLM response to extract action and memory update
   * Expects JSON format: { reasoning?: string, action_id: string, params?: object, memory_update?: {...} }
   * Handles both raw JSON and markdown-wrapped JSON (```json ... ```)
   */
  private parseResponse(
    response: string,
    _perspective: RolePerspective,
    roleId: string
  ): { action: Action; memory_update?: { mode: 'append' | 'replace'; content: string } } | null {
    try {
      // Clean response: remove markdown code block markers if present
      let cleanedResponse = response.trim();

      // Remove markdown code block markers (```json ... ``` or ``` ... ```)
      const markdownMatch = cleanedResponse.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
      if (markdownMatch) {
        cleanedResponse = markdownMatch[1].trim();
      }

      // Try to parse as JSON
      const parsed = JSON.parse(cleanedResponse) as LLMActionResponse;

      if (!parsed.action_id || typeof parsed.action_id !== 'string') {
        logger.warn({ response }, 'LLM response missing or invalid action_id');
        return null;
      }

      const action: Action = {
        action_id: parsed.action_id,
        role_id: roleId,
        params: parsed.params,
      };

      // Validate and extract memory_update if present
      let memory_update: { mode: 'append' | 'replace'; content: string } | undefined;

      if (parsed.memory_update) {
        if (
          parsed.memory_update.mode &&
          ['append', 'replace'].includes(parsed.memory_update.mode) &&
          parsed.memory_update.content &&
          typeof parsed.memory_update.content === 'string'
        ) {
          memory_update = {
            mode: parsed.memory_update.mode as 'append' | 'replace',
            content: parsed.memory_update.content,
          };
          logger.debug(
            { mode: memory_update.mode, contentLength: memory_update.content.length },
            'LLM executor: Parsed memory update'
          );
        } else {
          logger.warn(
            { memory_update: parsed.memory_update },
            'LLM executor: Invalid memory_update format, ignoring'
          );
        }
      }

      logger.debug(
        { action, reasoning: parsed.reasoning, hasMemoryUpdate: !!memory_update },
        'LLM executor: Parsed action from response'
      );

      return { action, memory_update };

    } catch (error) {
      logger.error(
        { error, response },
        'LLM executor: Failed to parse LLM response as JSON'
      );
      return null;
    }
  }

  /**
   * Validate action against action space
   * Checks if action_id exists and params match schema
   * Returns { valid: boolean, error?: string } for detailed error messages
   */
  private validateAction(
    action: Action,
    perspective: RolePerspective
  ): { valid: boolean; error?: string } {
    const { action_space_definition } = perspective;

    // Find matching action definition
    const actionDef = action_space_definition.actions.find(
      a => a.action_id === action.action_id
    );

    if (!actionDef) {
      const availableActions = action_space_definition.actions.map(a => a.action_id);
      const errorMsg = `行动ID "${action.action_id}" 不在可用行动列表中。`;
      logger.warn(
        {
          action_id: action.action_id,
          available: availableActions
        },
        'LLM executor: action_id not in legal action space'
      );
      return { valid: false, error: errorMsg };
    }

    // Validate params if action requires them
    if (actionDef.params_schema && Object.keys(actionDef.params_schema).length > 0) {
      if (!action.params) {
        const errorMsg = `行动 "${action.action_id}" 需要参数但未提供。需要的参数：${Object.keys(actionDef.params_schema).join(', ')}`;
        logger.warn(
          { action_id: action.action_id },
          'LLM executor: Action requires params but none provided'
        );
        return { valid: false, error: errorMsg };
      }

      // Basic type validation (can be enhanced)
      for (const [key, schema] of Object.entries(actionDef.params_schema)) {
        if (!(key in action.params)) {
          const errorMsg = `行动 "${action.action_id}" 缺少必需参数 "${key}"`;
          logger.warn(
            { action_id: action.action_id, missing_param: key },
            'LLM executor: Required parameter missing'
          );
          return { valid: false, error: errorMsg };
        }

        const value = action.params[key];
        const s = schema as any;
        const expectedType = s.type;

        // Type checking
        if (expectedType === 'number' || expectedType === 'integer') {
          if (typeof value !== 'number') {
            const errorMsg = `参数 "${key}" 类型错误：期望 ${expectedType}，实际为 ${typeof value}`;
            logger.warn(
              { action_id: action.action_id, param: key, expected: expectedType, got: typeof value },
              'LLM executor: Parameter type mismatch'
            );
            return { valid: false, error: errorMsg };
          }

          // Range validation
          if (s.minimum !== undefined && value < s.minimum) {
            const errorMsg = `参数 "${key}" 的值 ${value} 低于最小值 ${s.minimum}`;
            logger.warn(
              { action_id: action.action_id, param: key, value, minimum: s.minimum },
              'LLM executor: Parameter value below minimum'
            );
            return { valid: false, error: errorMsg };
          }

          if (s.maximum !== undefined && value > s.maximum) {
            const errorMsg = `参数 "${key}" 的值 ${value} 超过最大值 ${s.maximum}`;
            logger.warn(
              { action_id: action.action_id, param: key, value, maximum: s.maximum },
              'LLM executor: Parameter value above maximum'
            );
            return { valid: false, error: errorMsg };
          }
        } else if (expectedType === 'string') {
          if (typeof value !== 'string') {
            const errorMsg = `参数 "${key}" 类型错误：期望 ${expectedType}，实际为 ${typeof value}`;
            logger.warn(
              { action_id: action.action_id, param: key, expected: expectedType, got: typeof value },
              'LLM executor: Parameter type mismatch'
            );
            return { valid: false, error: errorMsg };
          }

          // Enum validation
          if (s.enum && !s.enum.includes(value)) {
            const errorMsg = `参数 "${key}" 的值 "${value}" 不在允许的值列表中。允许的值：${s.enum.join(', ')}`;
            logger.warn(
              { action_id: action.action_id, param: key, value, allowed: s.enum },
              'LLM executor: Parameter value not in allowed enum values'
            );
            return { valid: false, error: errorMsg };
          }
        } else if (expectedType === 'boolean') {
          if (typeof value !== 'boolean') {
            const errorMsg = `参数 "${key}" 类型错误：期望 ${expectedType}，实际为 ${typeof value}`;
            logger.warn(
              { action_id: action.action_id, param: key, expected: expectedType, got: typeof value },
              'LLM executor: Parameter type mismatch'
            );
            return { valid: false, error: errorMsg };
          }
        }
      }
    }

    logger.debug(
      { action },
      'LLM executor: Action validation passed'
    );

    return { valid: true };
  }

}

/**
 * Factory function to create LLMExecutor instance
 */
export function createLLMExecutor(fastify: FastifyInstance): LLMExecutor {
  return new LLMExecutor(fastify);
}

