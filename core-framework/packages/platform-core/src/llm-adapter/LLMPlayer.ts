/**
 * LLMPlayer - LLM玩家类
 * 
 * 表示一个由LLM控制的玩家，根据角色视角做决策
 */

import { LLMPlayer as LLMPlayerConfig, RolePerspective, PlayerAction } from '@nexus/shared-types';
import { LLMAdapter } from './LLMAdapter';

/**
 * LLM玩家
 */
export class LLMPlayer {
  private config: LLMPlayerConfig;
  private adapter: LLMAdapter;

  constructor(config: LLMPlayerConfig, adapter: LLMAdapter) {
    this.config = config;
    this.adapter = adapter;
  }

  /**
   * 根据角色视角决定行动
   */
  async decideAction(perspective: RolePerspective): Promise<PlayerAction> {
    try {
      return await this.adapter.decideAction(
        perspective,
        this.config.system_prompt
      );
    } catch (error) {
      console.error('[LLMPlayer] Failed to decide action:', error);
      throw error;
    }
  }

  /**
   * 获取LLM玩家配置
   */
  getConfig(): LLMPlayerConfig {
    return { ...this.config };
  }

  /**
   * 更新系统提示词
   */
  updateSystemPrompt(systemPrompt: string): void {
    this.config.system_prompt = systemPrompt;
  }

  /**
   * 更新模型参数
   */
  updateParameters(params: {
    temperature?: number;
    max_tokens?: number;
  }): void {
    if (params.temperature !== undefined) {
      this.config.temperature = params.temperature;
    }
    if (params.max_tokens !== undefined) {
      this.config.max_tokens = params.max_tokens;
    }
  }
}

/**
 * 创建LLM玩家实例
 */
export function createLLMPlayer(
  config: LLMPlayerConfig,
  adapter: LLMAdapter
): LLMPlayer {
  return new LLMPlayer(config, adapter);
}

