import { z } from 'zod';
import { nanoid } from 'nanoid';

// ============ Types ============

export interface GameMetadata {
    id: string;
    name: string;
    description: string;
    minPlayers: number;
    maxPlayers: number;
    roleIds?: string[] | Record<number, string[]>;
    enable_llm_memory?: boolean;
    auto_save_mode?: 'enabled' | 'disabled';
    getStatusText?: (perspective: RolePerspective) => string;
    ui?: {
        mode: 'url';
        /** URL to the game-ui.html page (loaded in sandboxed iframe) */
        url: string;
    };
}

export interface GameState {
    [key: string]: any;
}

export interface InitContext {
    players: string[];
    options?: any;
}

export interface Action {
    action_id: string;
    role_id: string;
    params?: any;
}

export interface ActionSpec {
    actions: ActionDefinition[];
}

export interface ActionDefinition {
    action_id: string;
    description: string;
    params_schema?: any; // JSON Schema
}

export type GameCommand =
    | { type: 'SAVE_STATE'; name: string }
    | { type: 'CLEAR_HISTORY' };

export type ActionResult<TState extends GameState = GameState> =
    | { success: true; nextState: TState; events?: HistoryEvent[]; commands?: GameCommand[] }
    | { success: false; error: string; errorCode?: string };

export interface HistoryEvent {
    turn: number;
    role_id: string;
    action: Action;
    description?: string;
    timestamp: number;
}

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
    message?: string;
}

export interface GameLogic<TState extends GameState = GameState> {
    getMetadata(): Promise<GameMetadata> | GameMetadata;
    initState(ctx: InitContext): Promise<TState> | TState;
    getCurrentRole(state: TState): Promise<string> | string;
    getLegalActions(state: TState, roleId: string): Promise<ActionSpec> | ActionSpec;
    applyAction(state: TState, action: Action): Promise<ActionResult<TState>> | ActionResult<TState>;
    isTerminal(state: TState): Promise<boolean> | boolean;
    getWinners(state: TState): Promise<string[] | null> | string[] | null;
    toRolePerspective(
        state: TState,
        roleId: string,
        wholeHistory: HistoryEvent[],
        diffHistory: HistoryEvent[]
    ): Promise<RolePerspective> | RolePerspective;
    generateStatePrompt(perspective: RolePerspective): string;
}

// ============ Player & Room Types (Restored) ============

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
    temperature?: number;
    display_name: string;
    join_time: string;
    status: 'active' | 'inactive' | 'error';
    memory?: string;
}

export type Player = HumanPlayer | LLMPlayer;

export type PlayerList = Record<string, Player>;

export type RoleMapping = Record<string, string>;

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
    selected_player_count?: number;
    created_at: string;
    updated_at?: string;
}

export interface ValidationResult {
    valid: boolean;
    error?: string;
}

export type JsonSchemaProperty = any; // Placeholder

// ============ Base Implementation ============

export abstract class BaseGameLogic<TState extends GameState> implements GameLogic<TState> {
    abstract getMetadata(): GameMetadata;
    abstract initState(ctx: InitContext): TState;
    abstract getCurrentRole(state: TState): string;
    abstract getLegalActions(state: TState, roleId: string): ActionSpec;
    abstract applyAction(state: TState, action: Action): ActionResult<TState>;
    abstract isTerminal(state: TState): boolean;
    abstract getWinners(state: TState): string[] | null;
    abstract toRolePerspective(
        state: TState,
        roleId: string,
        wholeHistory: HistoryEvent[],
        diffHistory: HistoryEvent[]
    ): RolePerspective;

    serializeState(state: TState): string {
        return JSON.stringify(state);
    }

    deserializeState(data: string): TState {
        return JSON.parse(data);
    }

    generateStatePrompt(perspective: RolePerspective): string {
        return defaultStatePromptGenerator(perspective);
    }

    protected cloneState(state: TState): TState {
        return JSON.parse(JSON.stringify(state));
    }
}

// ============ Utilities ============

export const SPECTATOR_ROLE_ID = 'nexus_reserved_specator';

export function isSpectator(roleId: string): boolean {
    return roleId === SPECTATOR_ROLE_ID;
}

export function defaultStatePromptGenerator(perspective: RolePerspective): string {
    return JSON.stringify(perspective);
}

export function cloneState<T>(state: T): T {
    return JSON.parse(JSON.stringify(state));
}

export function validateAction(action: Action, spec: ActionSpec): ValidationResult {
    // Placeholder validation
    return { valid: true };
}

export function isMultiPlayerCountConfig(roleIds: string[] | Record<number, string[]> | undefined): roleIds is Record<number, string[]> {
    return typeof roleIds === 'object' && roleIds !== null && !Array.isArray(roleIds);
}

export function getRoleIdsForPlayerCount(roleIds: string[] | Record<number, string[]> | undefined, playerCount?: number): string[] {
    if (!roleIds) return [];
    if (Array.isArray(roleIds)) return roleIds;
    if (playerCount && roleIds[playerCount]) return roleIds[playerCount];
    return [];
}

export function getAvailablePlayerCounts(roleIds: string[] | Record<number, string[]> | undefined): number[] {
    if (!roleIds) return [];
    if (Array.isArray(roleIds)) return [roleIds.length];
    return Object.keys(roleIds).map(Number);
}

export function getGameStatusText(metadata: GameMetadata, perspective: RolePerspective): string {
    if (metadata.getStatusText) return metadata.getStatusText(perspective);
    return 'Game in progress';
}

export const stateSerializer = {
    serializeSet<T>(set: Set<T>): T[] { return Array.from(set); },
    deserializeSet<T>(arr: T[]): Set<T> { return new Set(arr); },
    serializeMap<K, V>(map: Map<K, V>): [K, V][] { return Array.from(map.entries()); },
    deserializeMap<K, V>(entries: [K, V][]): Map<K, V> { return new Map(entries); },
    jsonReplacer(_key: string, value: unknown): unknown { return value; },
    jsonReviver(_key: string, value: unknown): unknown { return value; },
    stringify<T>(value: T): string { return JSON.stringify(value); },
    parse<T>(text: string): T { return JSON.parse(text); }
};

// Export dependencies
export { z };
