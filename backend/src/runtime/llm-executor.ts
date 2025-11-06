/**
 * LLM Executor
 * Handles LLM player decision making using non-streaming API
 */

import { FastifyInstance } from 'fastify';
import { RolePerspective, Action } from '../games/types.js';
import logger from '../utils/logger.js';

/**
 * LLM response format (structured JSON)
 */
interface LLMActionResponse {
  action_id: string;
  params?: Record<string, any>;
  reasoning?: string; // Optional: LLM's reasoning for debugging
  
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
 * Handles LLM player decision making with retry logic
 */
export class LLMExecutor {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Execute LLM decision for a role (non-streaming)
   * 
   * @param roomId Room ID
   * @param roleId Role ID
   * @param perspective Role perspective
   * @param modelName LLM model name (e.g., "gpt-4o-mini-2024-07-18")
   * @param systemPrompt System prompt for the LLM
   * @param currentMemory Current memory state (null if memory not enabled)
   * @param previousError Optional error message from previous failed attempt
   * @returns Action and optional memory update, or null if execution fails
   */
  async executeDecision(
    roomId: string,
    roleId: string,
    perspective: RolePerspective,
    modelName: string,
    systemPrompt: string,
    currentMemory: string | null,
    previousError?: string
  ): Promise<{ action: Action; memory_update?: { mode: 'append' | 'replace'; content: string } } | null> {
    logger.info(
      { roomId, roleId, modelName },
      'LLM executor: Starting decision execution'
    );

    // Retry logic: 3 attempts with exponential backoff
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info(
          { roomId, roleId, attempt },
          `LLM executor: Attempt ${attempt}/3`
        );

        // 1. Format perspective into LLM prompt (with memory if enabled)
        const userPrompt = this.formatPrompt(perspective, currentMemory, previousError);

        // 2. Call LLM API (non-streaming)
        const llmClient = this.fastify.appAuth.llmClient;
        
        logger.debug(
          { roomId, roleId, promptLength: userPrompt.length },
          'LLM executor: Calling LLM API'
        );
        logger.debug({systemPrompt,userPrompt }, 'LLM executor: User prompt');
        const content = await llmClient.getChatContent({
          model: modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          // Note: response_format is not supported by all LLM SDK versions
          // Rely on prompt engineering to ensure JSON output
        });

        logger.debug(
          { roomId, roleId, responseLength: content.length },
          'LLM executor: Received LLM response'
        );

        // 3. Parse LLM response to extract action and memory update
        const parsed = this.parseResponse(content, perspective, roleId);

        if (!parsed || !parsed.action) {
          logger.warn(
            { roomId, roleId, attempt, response: content },
            'LLM executor: Failed to parse valid action from LLM response'
          );
          
          if (attempt === 3) {
            logger.error(
              { roomId, roleId },
              'LLM executor: All retry attempts exhausted'
            );
            return null;
          }
          
          // Exponential backoff: 1s, 2s, 4s
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
          continue;
        }

        // 4. Validate action against action space
        if (!this.validateAction(parsed.action, perspective)) {
          logger.warn(
            { roomId, roleId, attempt, action: parsed.action },
            'LLM executor: Action validation failed'
          );
          
          if (attempt === 3) {
            logger.error(
              { roomId, roleId },
              'LLM executor: All retry attempts exhausted'
            );
            return null;
          }
          
          await this.sleep(Math.pow(2, attempt - 1) * 1000);
          continue;
        }

        logger.info(
          { roomId, roleId, action: parsed.action, hasMemoryUpdate: !!parsed.memory_update },
          'LLM executor: Successfully generated valid action'
        );

        return {
          action: parsed.action,
          memory_update: parsed.memory_update,
        };

      } catch (error) {
        logger.error(
          { roomId, roleId, attempt, error },
          `LLM executor: Error on attempt ${attempt}/3`
        );

        if (attempt === 3) {
          logger.error(
            { roomId, roleId, error },
            'LLM executor: All retry attempts failed'
          );
          return null;
        }

        // Exponential backoff with jitter
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        const jitter = Math.random() * 500;
        await this.sleep(backoffMs + jitter);
      }
    }

    return null;
  }

  /**
   * Format perspective into LLM prompt
   * Constructs a detailed prompt with game rules, state, history, and available actions
   * 
   * @param perspective Role perspective
   * @param currentMemory Current memory state (null if memory not enabled)
   * @param previousError Optional error message from previous failed attempt
   */
  private formatPrompt(perspective: RolePerspective, currentMemory: string | null, previousError?: string): string {
    const { 
      global_rules, 
      current_state, 
      whole_history, 
      diff_history,
      your_role, 
      action_space_definition 
    } = perspective;

    // Format history
    const historyText = whole_history.length > 0
      ? whole_history.map(h => 
          `Turn ${h.turn}: ${h.role_id} → ${h.action.action_id}${
            h.action.params ? ` (${JSON.stringify(h.action.params)})` : ''
          }${h.description ? ` - ${h.description}` : ''}`
        ).join('\n')
      : '(Game just started)';

    const recentHistoryText = diff_history.length > 0
      ? diff_history.map(h => 
          `Turn ${h.turn}: ${h.role_id} → ${h.action.action_id}${
            h.action.params ? ` (${JSON.stringify(h.action.params)})` : ''
          }${h.description ? ` - ${h.description}` : ''}`
        ).join('\n')
      : '(No new events since your last turn)';

    // Format available actions
    const actionsText = action_space_definition.actions.map(a => {
      if (!a.params_schema || Object.keys(a.params_schema).length === 0) {
        // Fixed option action (no parameters)
        return `- action_id: "${a.action_id}"\n  描述: ${a.description}\n  参数: 无`;
      } else {
        // Parameterized action
        const paramsLines = Object.entries(a.params_schema)
          .map(([key, schema]) => {
            let line = `    * ${key} (${schema.type}): ${schema.description || ''}`;
            if (schema.minimum !== undefined || schema.maximum !== undefined) {
              line += ` [范围: ${schema.minimum}-${schema.maximum}]`;
            }
            if (schema.enum) {
              line += ` [可选值: ${schema.enum.join(', ')}]`;
            }
            return line;
          })
          .join('\n');
        return `- action_id: "${a.action_id}"\n  描述: ${a.description}\n  参数:\n${paramsLines}`;
      }
    }).join('\n\n');

    // Construct memory section if memory is enabled
    const memorySection = currentMemory !== null ? `
# 🧠 你的记忆
以下是你在本局游戏中积累的个人记忆和推理笔记：

${currentMemory || '(暂无记忆)'}

---
` : '';

    // Construct base prompt
    const basePrompt = `# 游戏规则
${global_rules}

# 你的身份
角色: ${your_role.identity}
目标: ${your_role.goal}
${your_role.is_current ? '**现在轮到你行动**' : '(目前不是你的回合)'}
${memorySection}
# 当前游戏状态
${JSON.stringify(current_state)}

# 完整历史记录
${historyText}

# 自上次行动以来的变化
${recentHistoryText}

# 可用行动列表
${actionsText}
${previousError ? `
# ⚠️ 上次行动被拒绝
你上次选择的行动被游戏逻辑拒绝，原因：${previousError}
请重新分析当前局势，选择一个**合法且有效**的行动。
` : ''}`;

    // Add memory update instructions if memory is enabled
    const memoryInstructions = currentMemory !== null ? `

**记忆更新（可选）**：
- 你可以在 \`memory_update\` 字段中更新你的记忆
- \`mode: "append"\` - 追加到现有记忆（推荐，用于累积推理链）
- \`mode: "replace"\` - 完全替换记忆（慎用，仅当需要重置推理时）
- 如果本回合无需更新记忆，可省略 \`memory_update\` 字段

**记忆更新示例**：
\`\`\`json
{
  "action_id": "vote",
  "params": { "target": "player_3" },
  "reasoning": "3号玩家发言逻辑矛盾",
  "memory_update": {
    "mode": "append",
    "content": "第2天：我投票给3号，因为他的预言家发言不可信。需要重点观察5号和7号的互动。"
  }
}
\`\`\`
` : '';

    return `${basePrompt}

# 任务要求
请分析当前局势，选择一个最优行动。你必须严格按照以下JSON格式返回：

\`\`\`json
{
  "action_id": "行动ID字符串（从上述可用行动列表中选择，例如 'place'）",
  "params": {
    "参数名": "参数值"
  },
  "reasoning": "你的决策思路（可选，用于调试）"${currentMemory !== null ? `,
  "memory_update": {
    "mode": "append",
    "content": "本回合的新观察和推理（可选）"
  }` : ''}
}
\`\`\`

**示例（五子棋落子）**：
\`\`\`json
{
  "action_id": "place",
  "params": {
    "row": 7,
    "col": 6
  },
  "reasoning": "我选择在(7, 6)落子以阻止对手"
}
\`\`\`
${memoryInstructions}
**重要提示**：
1. action_id 必须是纯字符串，不要包含参数（错误示例：❌ "place(row: 7, col: 6)"）
2. action_id 必须完全匹配上述可用行动列表中的某个 action_id
3. 如果行动需要参数，params 字段必须包含所有必需的参数
4. 参数的类型和值必须符合行动定义的约束
5. 只返回JSON对象，不要包含其他文字说明`;
  }

  /**
   * Parse LLM response to extract action and memory update
   * Expects JSON format: { action_id: string, params?: object, reasoning?: string, memory_update?: {...} }
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
   */
  private validateAction(
    action: Action,
    perspective: RolePerspective
  ): boolean {
    const { action_space_definition } = perspective;

    // Find matching action definition
    const actionDef = action_space_definition.actions.find(
      a => a.action_id === action.action_id
    );

    if (!actionDef) {
      logger.warn(
        { 
          action_id: action.action_id,
          available: action_space_definition.actions.map(a => a.action_id)
        },
        'LLM executor: action_id not in legal action space'
      );
      return false;
    }

    // Validate params if action requires them
    if (actionDef.params_schema && Object.keys(actionDef.params_schema).length > 0) {
      if (!action.params) {
        logger.warn(
          { action_id: action.action_id },
          'LLM executor: Action requires params but none provided'
        );
        return false;
      }

      // Basic type validation (can be enhanced)
      for (const [key, schema] of Object.entries(actionDef.params_schema)) {
        if (!(key in action.params)) {
          logger.warn(
            { action_id: action.action_id, missing_param: key },
            'LLM executor: Required parameter missing'
          );
          return false;
        }

        const value = action.params[key];
        const expectedType = schema.type;

        // Type checking
        if (expectedType === 'number' || expectedType === 'integer') {
          if (typeof value !== 'number') {
            logger.warn(
              { action_id: action.action_id, param: key, expected: expectedType, got: typeof value },
              'LLM executor: Parameter type mismatch'
            );
            return false;
          }
          
          // Range validation
          if (schema.minimum !== undefined && value < schema.minimum) {
            logger.warn(
              { action_id: action.action_id, param: key, value, minimum: schema.minimum },
              'LLM executor: Parameter value below minimum'
            );
            return false;
          }
          
          if (schema.maximum !== undefined && value > schema.maximum) {
            logger.warn(
              { action_id: action.action_id, param: key, value, maximum: schema.maximum },
              'LLM executor: Parameter value above maximum'
            );
            return false;
          }
        } else if (expectedType === 'string') {
          if (typeof value !== 'string') {
            logger.warn(
              { action_id: action.action_id, param: key, expected: expectedType, got: typeof value },
              'LLM executor: Parameter type mismatch'
            );
            return false;
          }
          
          // Enum validation
          if (schema.enum && !schema.enum.includes(value)) {
            logger.warn(
              { action_id: action.action_id, param: key, value, allowed: schema.enum },
              'LLM executor: Parameter value not in allowed enum values'
            );
            return false;
          }
        } else if (expectedType === 'boolean') {
          if (typeof value !== 'boolean') {
            logger.warn(
              { action_id: action.action_id, param: key, expected: expectedType, got: typeof value },
              'LLM executor: Parameter type mismatch'
            );
            return false;
          }
        }
      }
    }

    logger.debug(
      { action },
      'LLM executor: Action validation passed'
    );

    return true;
  }

  /**
   * Sleep utility for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Factory function to create LLMExecutor instance
 */
export function createLLMExecutor(fastify: FastifyInstance): LLMExecutor {
  return new LLMExecutor(fastify);
}

