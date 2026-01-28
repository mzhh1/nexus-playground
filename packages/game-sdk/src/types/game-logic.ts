/**
 * @nexus/game-sdk - Game Logic Type Definitions
 * Core interfaces that all games must implement
 */

import { z } from 'zod';

// ============ Game Metadata ============

/**
 * Game metadata with version control for Module Federation compatibility
 */
export interface GameMetadata {
    /** Unique game identifier */
    id: string;
    /** Display name */
    name: string;
    /** Game rules description */
    description: string;
    /** Minimum number of players */
    minPlayers: number;
    /** Maximum number of players */
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
     */
    roleIds: string[] | Record<number, string[]>;

    /**
     * （可选）为多人数配置提供的人数描述
     * Example: { 6: '6人标准局', 8: '8人进阶局', 12: '12人完整局' }
     */
    playerCountLabels?: Record<number, string>;

    /**
     * Extract status text from perspective for display in control bar
     */
    getStatusText?: (perspective: RolePerspective) => string;

    /**
     * Enable LLM memory system for this game
     * @default false
     */
    enable_llm_memory?: boolean;

    // ========== Version Control (Module Federation) ==========

    /**
     * Semantic version number (e.g., "1.2.0")
     * Used for display and release tracking
     */
    version: string;

    /**
     * Logic version number (incrementing integer)
     * Used for frontend/backend compatibility checks
     * Increment this when making breaking changes to action format or state structure
     */
    logicVersion: number;
}

// ============ Game State ============

/**
 * Base game state interface
 * Games should extend this with custom fields
 */
export interface GameState {
    [key: string]: unknown;
}

/**
 * Common base for board games
 */
export interface BaseBoardGameState extends GameState {
    currentRole: string;
    turn: number;
    winner: string | null;
}

/**
 * Initialization context for game state
 */
export interface InitContext {
    /** List of role IDs (e.g., ["player_X", "player_O"]) */
    players: string[];
    /** Game-specific configuration */
    options?: Record<string, unknown>;
}

// ============ Action System ============

/**
 * JSON Schema property definition for action parameters
 */
export interface JsonSchemaProperty {
    type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
    description?: string;
    minimum?: number;
    maximum?: number;
    enum?: unknown[];
    default?: unknown;
    items?: JsonSchemaProperty;
    properties?: Record<string, JsonSchemaProperty>;
    required?: string[];
}

/**
 * Action definition - supports both fixed options and parameterized templates
 */
export interface ActionDefinition {
    /** Unique action identifier */
    action_id: string;
    /** Natural language description for LLM */
    description: string;
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
    /** Matches ActionDefinition.action_id */
    action_id: string;
    /** Action parameters (if required) */
    params?: Record<string, unknown>;
    /** Role submitting the action */
    role_id: string;
}

/**
 * Result of action processing
 */
export type ActionResult<TState extends GameState = GameState> =
    | { success: true; nextState: TState; events?: HistoryEvent[] }
    | { success: false; error: string; errorCode?: string };

// ============ History & Events ============

/**
 * History event - records an action in the game history
 */
export interface HistoryEvent {
    turn: number;
    role_id: string;
    action: Action;
    /** ISO 8601 format */
    timestamp: string;
    /** Natural language description for LLM */
    description?: string;
}

// ============ Role Perspective ============

/**
 * Role perspective - filtered view of game state for a specific role
 * This is sent to both human players (frontend) and LLM players
 */
export interface RolePerspective {
    /** Game rules in natural language */
    global_rules: string;
    /** Complete game history */
    whole_history: HistoryEvent[];
    /** Changes since role's last action */
    diff_history: HistoryEvent[];
    /** Role's filtered view of game state */
    current_state: unknown;
    /** Role information */
    your_role: {
        /** Role identity (e.g., "Player X") */
        identity: string;
        /** Role's objective */
        goal: string;
        /** Is it this role's turn? */
        is_current: boolean;
    };
    /** Legal actions available */
    action_space_definition: ActionSpec;
    /** Games can add custom fields */
    [key: string]: unknown;
}

// ============ Game Logic Interface ============

/**
 * Game Logic Interface
 * All games must implement this interface
 */
export interface GameLogic<TState extends GameState = GameState> {
    // ========== Metadata ==========

    /** Get game metadata */
    getMetadata(): GameMetadata;

    // ========== Runtime Validation ==========

    /**
     * Get Zod schema for action validation
     */
    getActionSchema(): z.ZodSchema;

    /**
     * Validate action payload against schema
     */
    validatePayload(actionPayload: any): boolean;

    // ========== State Management ==========

    /** Initialize game state */
    initState(ctx: InitContext): TState;

    /** Get current acting role */
    getCurrentRole(state: TState): string;

    // ========== Action Processing ==========

    /** Get legal actions for a role */
    getLegalActions(state: TState, roleId: string): ActionSpec;

    /**
     * Apply action and return new state
     * MUST be a pure function - do not modify input state
     */
    applyAction(state: TState, action: Action): ActionResult<TState>;

    // ========== Terminal Detection ==========

    /** Check if game is finished */
    isTerminal(state: TState): boolean;

    /** Get winners (null if game not finished or draw) */
    getWinners(state: TState): string[] | null;

    // ========== Perspective Generation ==========

    /**
     * Generate role perspective (core method)
     * Filters game state for a specific role
     */
    toRolePerspective(
        state: TState,
        roleId: string,
        wholeHistory: HistoryEvent[],
        diffHistory: HistoryEvent[]
    ): RolePerspective;

    /**
     * Generate state prompt for LLM player
     */
    generateStatePrompt(perspective: RolePerspective): string;

    // ========== Serialization (for persistence) ==========

    /**
     * Serialize state to string for storage/transmission
     * Override for states with Set/Map or complex types
     */
    serializeState(state: TState): string;

    /**
     * Deserialize state from string
     */
    deserializeState(data: string): TState;

    // ========== Optional: AI Support ==========

    /**
     * Heuristic evaluation function (optional)
     * Returns positive if roleId is winning, negative if losing, 0 for even
     */
    evaluate?(state: TState, roleId: string): number;
}
