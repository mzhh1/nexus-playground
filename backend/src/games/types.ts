/**
 * Game System Type Definitions
 * Core interfaces that all games must implement
 */

// ============ Game Metadata ============

export interface GameMetadata {
  id: string; // Unique game identifier
  name: string; // Display name
  description: string; // Game rules description
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
   * 当使用多人数配置时：
   * - 前端会先显示人数选择器
   * - 选择人数后再显示对应的角色映射配置
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
   * Extract status text from perspective for display in control bar
   * Example: "Turn 3 - Player X's turn" or "Game Over - Player O wins"
   */
  getStatusText?: (perspective: RolePerspective) => string;

  /**
   * Enable LLM memory system for this game
   * - true: LLM players can maintain memory across turns (e.g., Werewolf)
   * - false: No memory needed (e.g., Tic-Tac-Toe, Chess)
   * @default false
   */
  enable_llm_memory?: boolean;
}

// ============ Game State ============

/**
 * Authoritative game state (never sent to clients)
 * Games can extend this with custom fields
 */
export interface GameState {
  [key: string]: any;
}

/**
 * Initialization context for game state
 */
export interface InitContext {
  players: string[]; // List of role IDs (e.g., ["player_X", "player_O"])
  options?: Record<string, any>; // Game-specific configuration
}

// ============ Action System ============

/**
 * JSON Schema property definition
 */
export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
  default?: any;
  items?: JsonSchemaProperty; // For array type
  properties?: Record<string, JsonSchemaProperty>; // For object type
  required?: string[]; // For object type
}

/**
 * Action definition - supports both fixed options and parameterized templates
 */
export interface ActionDefinition {
  action_id: string; // Unique action identifier
  description: string; // Natural language description for LLM

  /**
   * Parameter schema (JSON Schema format)
   * - null/undefined: Fixed option, no parameters (e.g., "pass", "fold")
   * - defined: Parameterized template (e.g., "place(row, col)", "bet(amount)")
   */
  params_schema?: Record<string, JsonSchemaProperty> | null;
}

/**
 * Action specification - defines all legal actions for a role
 */
export interface ActionSpec {
  actions: ActionDefinition[];
}

/**
 * Action submitted by player
 */
export interface Action {
  action_id: string; // Matches ActionDefinition.action_id
  params?: Record<string, any>; // Action parameters (if required)
  role_id: string; // Role submitting the action
}

/**
 * Result of action processing
 */
export type ActionResult =
  | { success: true; nextState: GameState; events?: HistoryEvent[] }
  | { success: false; error: string; errorCode?: string };

// ============ History & Events ============

/**
 * History event - records an action in the game history
 */
export interface HistoryEvent {
  turn: number;
  role_id: string;
  action: Action;
  timestamp: string; // ISO 8601 format
  description?: string; // Natural language description for LLM
}

// ============ Role Perspective ============

/**
 * Role perspective - filtered view of game state for a specific role
 * This is sent to both human players (frontend) and LLM players
 */
export interface RolePerspective {
  global_rules: string; // Game rules in natural language
  whole_history: HistoryEvent[]; // Complete game history
  diff_history: HistoryEvent[]; // Changes since role's last action
  current_state: any; // Role's filtered view of game state
  your_role: {
    identity: string; // Role identity (e.g., "Player X")
    goal: string; // Role's objective
    is_current: boolean; // Is it this role's turn?
  };
  action_space_definition: ActionSpec; // Legal actions available

  // Games can add custom fields
  [key: string]: any;
}

// ============ Game Logic Interface ============

/**
 * Game Logic Interface
 * All games must implement this interface
 */
export interface GameLogic {
  /**
   * Get game metadata
   */
  getMetadata(): GameMetadata;

  /**
   * Initialize game state
   */
  initState(ctx: InitContext): GameState;

  /**
   * Get current acting role
   */
  getCurrentRole(state: GameState): string;

  /**
   * Get legal actions for a role
   */
  getLegalActions(state: GameState, roleId: string): ActionSpec;

  /**
   * Apply action and return new state
   * MUST be a pure function - do not modify input state
   */
  applyAction(state: GameState, action: Action): ActionResult;

  /**
   * Check if game is finished
   */
  isTerminal(state: GameState): boolean;

  /**
   * Get winners (null if game not finished or draw)
   */
  getWinners(state: GameState): string[] | null;

  /**
   * Generate role perspective (core method)
   * Filters game state for a specific role
   *
   * @param state Authoritative game state
   * @param roleId Role ID
   * @param wholeHistory Complete game history
   * @param diffHistory Differential history (since role's last action)
   */
  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective;

  /**
   * Generate state prompt for LLM player
   * This method is called by the LLM executor to generate the state portion of the prompt.
   * Game developers have full control over how the state is presented to the LLM.
   * 
   * @param perspective Role perspective (contains state, history, role info, etc.)
   * @returns State prompt string (will be combined with action prompt, memory, and task prompt by the system)
   */
  generateStatePrompt(perspective: RolePerspective): string;
}

// ============ Runtime Types ============

/**
 * Player types
 */
export type PlayerType = 'human' | 'llm';

export interface HumanPlayer {
  type: 'human';
  uid: string; // User ID
  display_name: string;
  join_time: string;
  status: 'online' | 'offline' | 'banned';
}

export interface LLMPlayer {
  type: 'llm';
  model_name: string; // e.g., "gpt-4o-mini"
  system_prompt: string;
  temperature?: number; // Temperature parameter for LLM (default: 0.7)
  display_name: string;
  join_time: string;
  status: 'active' | 'inactive' | 'error';
  
  /**
   * LLM player memory (only used when game's enable_llm_memory is true)
   * Stores accumulated reasoning, observations, and strategies across turns
   * - Cleared when game starts
   * - Updated after each action (append or replace mode)
   * - Each LLM player has independent memory
   */
  memory?: string;
}

export type Player = HumanPlayer | LLMPlayer;

/**
 * Room player list
 * Maps room_player_id to player info
 */
export type PlayerList = Record<string, Player>;

/**
 * Role mapping
 * Maps role_id (game logic) to room_player_id
 */
export type RoleMapping = Record<string, string>;

/**
 * Room state in Redis
 */
export interface RoomState {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: 'open' | 'playing' | 'paused';
  is_public: boolean;
  resume_locked: boolean;
  
  // Player management
  player_list: PlayerList;
  
  // Game state
  role_mapping: RoleMapping;
  game_state: GameState | null;
  history: HistoryEvent[];
  
  /**
   * 选择的游戏人数（仅多人数配置游戏使用）
   * 当游戏的 roleIds 为 Record<number, string[]> 格式时，
   * 此字段记录主人选择的游戏人数配置
   */
  selected_player_count?: number;
  
  // Metadata
  version: number; // Optimistic locking
  created_at: string;
  updated_at: string;
}

// ============ Spectator Utilities ============

/**
 * Spectator role ID constant (loaded from environment variable)
 * Default: 'spectator' for backward compatibility
 */
export const SPECTATOR_ROLE_ID = process.env.SPECTATOR_ROLE_ID || 'spectator';

/**
 * Check if a role ID represents a spectator
 * @param roleId - The role ID to check
 * @returns true if the role is a spectator, false otherwise
 */
export function isSpectator(roleId: string): boolean {
  return roleId === SPECTATOR_ROLE_ID;
}

// ============ Multi-Player Count Utilities ============

/**
 * 判断 roleIds 是否为多人数配置格式
 * @param roleIds - 游戏的 roleIds 配置
 * @returns true 如果是多人数配置（Record<number, string[]>），false 如果是传统格式（string[]）
 */
export function isMultiPlayerCountConfig(
  roleIds: string[] | Record<number, string[]>
): roleIds is Record<number, string[]> {
  return typeof roleIds === 'object' && !Array.isArray(roleIds);
}

/**
 * 获取指定人数的角色列表
 * @param roleIds - 游戏的 roleIds 配置
 * @param playerCount - 游戏人数（可选）
 * @returns 角色ID列表
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
 * @param roleIds - 游戏的 roleIds 配置
 * @returns 人数列表（按升序排列），如果是传统格式则返回空数组
 */
export function getAvailablePlayerCounts(
  roleIds: string[] | Record<number, string[]>
): number[] {
  if (isMultiPlayerCountConfig(roleIds)) {
    return Object.keys(roleIds).map(Number).sort((a, b) => a - b);
  }
  return [];
}

