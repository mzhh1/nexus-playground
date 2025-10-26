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
   * Extract status text from perspective for display in control bar
   * Example: "Turn 3 - Player X's turn" or "Game Over - Player O wins"
   */
  getStatusText?: (perspective: RolePerspective) => string;
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
  display_name: string;
  join_time: string;
  status: 'active' | 'inactive' | 'error';
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
  room_status: 'open' | 'playing' | 'paused' | 'finished';
  
  // Player management
  player_list: PlayerList;
  
  // Game state
  role_mapping: RoleMapping;
  game_state: GameState | null;
  history: HistoryEvent[];
  
  // Metadata
  version: number; // Optimistic locking
  created_at: string;
  updated_at: string;
}

