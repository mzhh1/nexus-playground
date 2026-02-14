/**
 * Frontend Type Definitions
 * Shared types for the frontend (mirrors backend types)
 */

// ============ Game Types ============

export interface RolePerspective {
  global_rules: string;
  whole_history: HistoryEvent[];
  diff_history: HistoryEvent[];
  current_state: any;
  your_role: {
    identity: string;
    goal: string;
    is_current: boolean;
  };
  action_space_definition: ActionSpec;
  [key: string]: any;
}

export interface ActionSpec {
  actions: ActionDefinition[];
}

export interface ActionDefinition {
  action_id: string;
  description: string;
  params_schema?: Record<string, JsonSchemaProperty> | null;
}

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
  default?: any;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export interface Action {
  action_id: string;
  params?: Record<string, any>;
  role_id: string;
}

export interface HistoryEvent {
  turn: number;
  role_id: string;
  action: Action;
  timestamp: string;
  description?: string;
}

// ============ Player Types ============

export type PlayerType = 'human' | 'llm';

export interface HumanPlayer {
  type: 'human';
  uid: string;
  display_name: string;
  join_time: string;
  status: 'online' | 'offline' | 'banned';
}

export interface LLMPlayer {
  type: 'llm';
  model_name: string;
  system_prompt: string;
  display_name: string;
  join_time: string;
  status: 'active' | 'inactive' | 'error';
  /**
   * LLM player memory (independent for each LLM player)
   */
  memory?: string;
}

export type Player = HumanPlayer | LLMPlayer;

export type PlayerList = Record<string, Player>;
export type RoleMapping = Record<string, string>;

// ============ Room Types ============

export interface RoomInfo {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: 'open' | 'playing' | 'paused';
  is_public: boolean;
  resume_locked: boolean;
  player_list: PlayerList;
  role_mapping: RoleMapping;
  has_game_state: boolean;
  player_count?: number;
  /**
   * 选择的游戏人数（仅多人数配置游戏使用）
   */
  selected_player_count?: number;
  created_at: string;
  updated_at?: string;
}

// ============ Game Metadata ============

export interface GameMetadata {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  /**
   * 游戏角色配置
   * 
   * 支持两种格式：
   * 
   * 1. 固定角色列表（适用于固定人数游戏）
   *    roleIds: ['player_X', 'player_O']
   * 
   * 2. 多人数配置（适用于可变人数游戏，如狼人杀）
   *    roleIds: {
   *      6: ['werewolf_1', 'werewolf_2', 'villager_1', ...],
   *      8: ['werewolf_1', 'werewolf_2', 'werewolf_3', ...],
   *      12: [...]
   *    }
   * 
   * Example (固定人数): ["player_X", "player_O"] for tic-tac-toe
   * Example (多人数): { 6: [...], 8: [...], 12: [...] } for werewolf
   */
  roleIds: string[] | Record<number, string[]>;
  /**
   * （可选）为多人数配置提供的人数描述
   * 仅当 roleIds 为 Record<number, string[]> 时使用
   * Example: { 6: '6人标准局', 8: '8人进阶局', 12: '12人完整局' }
   */
  playerCountLabels?: Record<number, string>;
  /**
   * Enable LLM memory system for this game
   * @default false
   */
  enable_llm_memory?: boolean;
}

// ============ Multi-Player Count Utilities ============

/**
 * 判断 roleIds 是否为多人数配置格式
 */
export function isMultiPlayerCountConfig(
  roleIds: string[] | Record<number, string[]>
): roleIds is Record<number, string[]> {
  return typeof roleIds === 'object' && !Array.isArray(roleIds);
}

/**
 * 获取指定人数的角色列表
 */
export function getRoleIdsForPlayerCount(
  roleIds: string[] | Record<number, string[]>,
  playerCount?: number
): string[] {
  // 传统格式：直接返回
  if (Array.isArray(roleIds)) {
    return roleIds;
  }

  // 多人数配置：返回指定人数的角色列表
  if (playerCount !== undefined && roleIds[playerCount]) {
    return roleIds[playerCount];
  }

  // 未指定人数或人数无效：返回最小支持人数的角色列表作为默认值
  const counts = Object.keys(roleIds).map(Number).sort((a, b) => a - b);
  return counts.length > 0 ? roleIds[counts[0]] : [];
}

/**
 * 获取多人数配置游戏支持的所有人数选项
 */
export function getAvailablePlayerCounts(
  roleIds: string[] | Record<number, string[]>
): number[] {
  if (isMultiPlayerCountConfig(roleIds)) {
    return Object.keys(roleIds).map(Number).sort((a, b) => a - b);
  }
  return [];
}

// ============ API Response Types ============

export interface ApiError {
  error: string;
  errorCode?: string;
  statusCode?: number;
}

export interface ApiSuccess {
  success: true;
  [key: string]: any;
}


export interface EngineConnectionResponse {
  url: string;
  token: string;
  role: string;
}
