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
}

export type Player = HumanPlayer | LLMPlayer;

export type PlayerList = Record<string, Player>;
export type RoleMapping = Record<string, string>;

// ============ Room Types ============

export interface RoomInfo {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: 'open' | 'playing' | 'paused' | 'finished';
  player_list: PlayerList;
  role_mapping: RoleMapping;
  has_game_state: boolean;
  player_count?: number;
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

