/**
 * LLMAdapter - LLM适配器
 * 
 * 封装 @autolabz/llmapi-sdk，提供LLM API调用功能
 */

import { createLLMClient } from '@autolabz/llmapi-sdk';
import type { AuthBridge } from '@autolabz/oauth-sdk';
import { RolePerspective, PlayerAction } from '@nexus/shared-types';

export interface LLMConfig {
  /** LLM API基础URL */
  baseUrl: string;
  
  /** 认证桥接 */
  auth: AuthBridge;
  
  /** 默认模型 */
  defaultModel?: string;
  
  /** 默认温度 */
  defaultTemperature?: number;
  
  /** 默认最大Token数 */
  defaultMaxTokens?: number;
}

export interface LLMRequest {
  /** 模型名称 */
  model?: string;
  
  /** 系统提示词 */
  systemPrompt?: string;
  
  /** 用户提示词 */
  userPrompt: string;
  
  /** 温度 */
  temperature?: number;
  
  /** 最大Token数 */
  maxTokens?: number;
  
  /** 是否启用JSON模式 */
  jsonMode?: boolean;
  
  /** 是否流式响应 */
  stream?: boolean;
}

export interface LLMResponse {
  /** 生成的文本 */
  content: string;
  
  /** 使用的Token数 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  
  /** 完成原因 */
  finishReason?: string;
  
  /** 原始响应 */
  raw?: any;
}

/**
 * LLM适配器
 */
export class LLMAdapter {
  private config: Required<Omit<LLMConfig, 'auth'>> & { auth: AuthBridge };
  private llmClient: ReturnType<typeof createLLMClient>;

  constructor(config: LLMConfig) {
    this.config = {
      defaultModel: 'gpt-4o-mini',
      defaultTemperature: 0.7,
      defaultMaxTokens: 1024,
      ...config,
    };
    
    // 创建 LLM 客户端
    this.llmClient = createLLMClient({
      baseURL: this.config.baseUrl,
      auth: this.config.auth as any,
    });
  }

  /**
   * 发送LLM请求
   */
  async complete(request: LLMRequest): Promise<LLMResponse> {
    const model = request.model || this.config.defaultModel;
    const temperature = request.temperature ?? this.config.defaultTemperature;
    const maxTokens = request.maxTokens || this.config.defaultMaxTokens;

    const messages: any[] = [];

    if (request.systemPrompt) {
      messages.push({
        role: 'system',
        content: request.systemPrompt,
      });
    }

    messages.push({
      role: 'user',
      content: request.userPrompt,
    });

    try {
      const chatRequest: any = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      };

      // 添加 JSON 模式支持
      if (request.jsonMode) {
        chatRequest.response_format = { type: 'json_object' };
      }

      const data = await this.llmClient.chat(chatRequest);

      return {
        content: data.choices?.[0]?.message?.content || '',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        finishReason: data.choices?.[0]?.finish_reason,
        raw: data,
      };
    } catch (error) {
      console.error('[LLMAdapter] Request failed:', error);
      throw error;
    }
  }

  /**
   * 根据角色视角生成行动决策
   */
  async decideAction(
    perspective: RolePerspective,
    systemPrompt?: string
  ): Promise<PlayerAction> {
    // 构建提示词
    const userPrompt = this.buildActionPrompt(perspective);

    // 请求LLM
    const response = await this.complete({
      systemPrompt: systemPrompt || this.getDefaultSystemPrompt(),
      userPrompt,
      jsonMode: true,
      temperature: 0.7,
    });

    // 解析JSON响应
    try {
      const action = JSON.parse(response.content);
      return {
        action_id: action.action_id,
        params: action.params,
        role_id: perspective.your_role.identity,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[LLMAdapter] Failed to parse action JSON:', response.content);
      throw new Error('Invalid JSON response from LLM');
    }
  }

  /**
   * 构建行动决策提示词
   */
  private buildActionPrompt(perspective: RolePerspective): string {
    let prompt = `# Game Rules\n${perspective.global_rules}\n\n`;

    prompt += `# Your Role\n`;
    prompt += `Identity: ${perspective.your_role.identity}\n`;
    prompt += `Goal: ${perspective.your_role.goal}\n\n`;

    if (perspective.whole_history.length > 0) {
      prompt += `# Game History\n`;
      for (const record of perspective.whole_history) {
        prompt += `Turn ${record.turn}: ${record.role_id} performed ${record.action}`;
        if (record.params) {
          prompt += ` with params ${JSON.stringify(record.params)}`;
        }
        prompt += `\n`;
      }
      prompt += `\n`;
    }

    prompt += `# Current State\n`;
    prompt += `${JSON.stringify(perspective.current_state, null, 2)}\n\n`;

    prompt += `# Available Actions\n`;
    if (perspective.action_space_definition.type === 'explicit_list') {
      prompt += `You must choose one of the following actions:\n`;
      for (const action of perspective.action_space_definition.actions) {
        prompt += `- ${action.action_id}: ${action.description}\n`;
      }
    } else if (perspective.action_space_definition.type === 'template') {
      prompt += `You can perform actions using the following templates:\n`;
      for (const template of perspective.action_space_definition.templates) {
        prompt += `- ${template.template_id}: ${template.description}\n`;
        if (template.params_schema) {
          prompt += `  Parameters: ${JSON.stringify(template.params_schema)}\n`;
        }
      }
    }

    prompt += `\n# Instructions\n`;
    prompt += `Analyze the current game state and choose the best action.\n`;
    prompt += `Respond with a JSON object in the following format:\n`;
    prompt += `{\n`;
    prompt += `  "action_id": "your_chosen_action",\n`;
    prompt += `  "params": { /* optional parameters */ },\n`;
    prompt += `  "reasoning": "brief explanation of your choice"\n`;
    prompt += `}\n`;

    return prompt;
  }

  /**
   * 获取默认系统提示词
   */
  private getDefaultSystemPrompt(): string {
    return (
      'You are an AI player in a game. ' +
      'Analyze the game state carefully and make strategic decisions. ' +
      'Always respond with valid JSON containing your chosen action.'
    );
  }

  /**
   * 流式生成（用于实时反馈）
   */
  async *completeStream(request: LLMRequest): AsyncGenerator<string> {
    const model = request.model || this.config.defaultModel;
    const temperature = request.temperature ?? this.config.defaultTemperature;
    const maxTokens = request.maxTokens || this.config.defaultMaxTokens;

    const messages: any[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.userPrompt });

    const chatRequest: any = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    };

    // 添加 JSON 模式支持
    if (request.jsonMode) {
      chatRequest.response_format = { type: 'json_object' };
    }

    // 使用 SDK 的流式方法
    const chunks: string[] = [];
    
    await this.llmClient.chatStream(chatRequest, {
      onEvent: (line: string) => {
        chunks.push(line);
      },
      onError: (error: Error) => {
        throw error;
      },
      onDone: () => {
        // 流式完成
      },
    });

    // 解析并 yield 内容
    for (const line of chunks) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

/**
 * 创建LLM适配器实例
 */
export function createLLMAdapter(config: LLMConfig): LLMAdapter {
  return new LLMAdapter(config);
}

