/**
 * Task Prompts for LLM Executor
 * Contains versions for with memory, without memory, and memory-only update scenarios.
 */

/**
 * Task prompt for games WITHOUT memory support
 */
export const TASK_PROMPT_NO_MEMORY = `
# 任务要求
请分析当前局势，选择一个最优行动。你必须严格按照以下JSON格式返回：

\`\`\`json
{
  "reasoning": "你的决策思路",
  "action_id": "行动ID字符串（从上述可用行动列表中选择，例如 'place'）",
  "params": {
    "参数名": "参数值"
  }
}
\`\`\`

**重要提示**：
1. action_id 必须是完全匹配上述可用行动列表中的某个 action_id 的纯字符串，不要包含参数（错误示例：❌ "place(row: 7, col: 6)"）
2. 如果行动需要参数，params 字段必须包含所有必需的参数
3. 参数的类型和值必须符合行动定义的约束
4. 只返回JSON对象，不要包含其他文字说明`;

/**
 * Task prompt for games WITH memory support
 */
export const TASK_PROMPT_WITH_MEMORY = `
# 任务要求
请分析当前局势，通过 reasoning 思考并选择一个最优行动。并可选更新记忆。你必须严格按照以下JSON格式返回：

\`\`\`json
{
  "reasoning": "你的决策思路",
  "action_id": "行动ID字符串（从上述可用行动列表中选择，例如 'place'）",
  "params": {
    "参数名": "参数值"
  },
  "memory_update": {
    "mode": "append/replace",
    "content": "本回合的新观察和推理（可选）"
  }
}
\`\`\`


**记忆更新说明**：
- 你可以在 \`memory_update\` 字段中更新你的记忆
- \`mode: "append"\` - 追加到现有记忆
- \`mode: "replace"\` - 替换记忆，如重新总结形成新的记忆
- 如果本回合无需更新记忆，可省略 \`memory_update\` 字段


**重要提示**：
1. action_id 必须是完全匹配上述可用行动列表中的某个 action_id 的纯字符串，不要包含参数（错误示例：❌ "place(row: 7, col: 6)"）
2. 如果行动需要参数，params 字段必须包含所有必需的参数
3. 参数的类型和值必须符合行动定义的约束
4. 只返回JSON对象，不要包含其他文字说明`;

/**
 * Task prompt for memory update only (no action required)
 */
export const NO_TASK_PROMPT_WITH_MEMORY = `
# 任务要求
当前无需行动，但你可以根据最新信息更新你的记忆。你必须严格按照以下JSON格式返回，不要包含其他文字说明：

\`\`\`json
{
  "reasoning": "你的观察和思考（可选）",
  "memory_update": {
    "mode": "append",
    "content": "本回合的新观察、推理和重要信息"
  }
}
\`\`\`


**记忆更新说明**：
- \`mode: "append"\` - 追加到现有记忆（推荐）
- \`mode: "replace"\` - 完全替换记忆，适合重新总结时使用
- 建议记录：其他玩家的行动、发言、投票、死亡信息、身份线索等关键信息
`;
