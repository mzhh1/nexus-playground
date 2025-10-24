/**
 * 游戏相关类型定义
 */

import { GlobalState, RoleMapping } from './core';

/**
 * 游戏配置
 */
export interface GameConfig {
  /** 游戏唯一标识 */
  id: string;
  
  /** 游戏名称 */
  name: string;
  
  /** 游戏描述 */
  description: string;
  
  /** 游戏缩略图 */
  thumbnail?: string;
  
  /** 最小玩家数 */
  minPlayers: number;
  
  /** 最大玩家数 */
  maxPlayers: number;
  
  /** 游戏标签 */
  tags?: string[];
  
  /** 是否支持AI玩家 */
  supportsAI: boolean;
  
  /** 游戏类型 */
  gameType: 'turn-based' | 'real-time' | 'hybrid';
  
  /** 信息类型 */
  informationType: 'perfect' | 'imperfect';
}

/**
 * 游戏实例
 */
export interface GameInstance {
  /** 实例ID */
  instanceId: string;
  
  /** 游戏配置 */
  config: GameConfig;
  
  /** 全局状态 */
  globalState: GlobalState;
  
  /** 角色映射 */
  roleMapping: RoleMapping;
  
  /** 游戏状态 */
  status: GameStatus;
  
  /** 创建时间 */
  createdAt: string;
  
  /** 更新时间 */
  updatedAt: string;
  
  /** 结束时间 */
  endedAt?: string;
  
  /** 游戏结果 */
  result?: GameResult;
}

/**
 * 游戏状态
 */
export type GameStatus = 
  | 'waiting'      // 等待玩家加入
  | 'ready'        // 准备开始
  | 'playing'      // 进行中
  | 'paused'       // 暂停
  | 'finished'     // 已结束
  | 'cancelled';   // 已取消

/**
 * 游戏结果
 */
export interface GameResult {
  /** 获胜者角色ID列表（可能是平局） */
  winners: string[];
  
  /** 结束原因 */
  endReason: 'normal' | 'timeout' | 'forfeit' | 'error';
  
  /** 各角色的最终得分或状态 */
  finalScores?: Record<string, number | string>;
  
  /** 额外信息 */
  metadata?: Record<string, any>;
}

/**
 * 游戏事件
 */
export interface GameEvent {
  /** 事件类型 */
  type: string;
  
  /** 事件数据 */
  data: any;
  
  /** 时间戳 */
  timestamp: string;
  
  /** 触发事件的角色ID */
  triggeredBy?: string;
}

