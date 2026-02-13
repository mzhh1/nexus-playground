/**
 * Game System Type Definitions
 * Re-exports from SDK + Backend-specific definitions
 */

// Explicitly re-export common types from SDK to avoid shadowing issues
export {
  BaseGameLogic,
  GameLogic,
  GameMetadata,
  InitContext,
  ActionSpec,
  Action,
  ActionResult,
  RolePerspective,
  isSpectator,
  SPECTATOR_ROLE_ID,
  // Add other SDK types as needed by consumers
  ActionDefinition,
  JsonSchemaProperty,
  HumanPlayer,
  LLMPlayer,
  Player,
  RoomInfo,
  ValidationResult,
  cloneState,
  validateAction,
  isMultiPlayerCountConfig,
  getRoleIdsForPlayerCount,
  getAvailablePlayerCounts,
  getGameStatusText,
  stateSerializer
} from '@nexus/game-sdk';

import {
  GameState as SDKGameState,
  HistoryEvent as SDKHistoryEvent,
  PlayerList as SDKPlayerList,
  RoleMapping as SDKRoleMapping,
  // We need to import these to use them in local definitions
} from '@nexus/game-sdk';

// Re-export types that we imported for local use
export type GameState = SDKGameState;
export type HistoryEvent = SDKHistoryEvent;
export type PlayerList = SDKPlayerList;
export type RoleMapping = SDKRoleMapping;

// ============ Backend Specific Types ============


/**
 * Room state in Redis
 * This is the full server-side state, unlike RoomInfo in SDK which is for clients
 */
export interface RoomState {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: 'open' | 'playing' | 'paused';
  is_public: boolean;
  resume_locked: boolean;

  // Player management
  player_list: SDKPlayerList;

  // Game state
  role_mapping: SDKRoleMapping;
  game_state: SDKGameState | null;
  history: SDKHistoryEvent[];

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

// Re-export other backend specific utilities if any were defined in the original file
// Checking original file...
// isSpectator, SPECTATOR_ROLE_ID are in SDK.
// isMultiPlayerCountConfig, getRoleIdsForPlayerCount, getAvailablePlayerCounts are in SDK.
// So we just need RoomState.
