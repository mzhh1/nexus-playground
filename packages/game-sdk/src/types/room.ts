/**
 * @nexus/game-sdk - Room & Player Type Definitions
 */

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
    temperature?: number;
    display_name: string;
    join_time: string;
    status: 'active' | 'inactive' | 'error';
    /**
     * LLM player memory (only used when game's enable_llm_memory is true)
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

// ============ Room Types ============

/**
 * Room info returned to frontend
 */
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

// ============ API Response Types ============

export interface ApiError {
    error: string;
    errorCode?: string;
    statusCode?: number;
}

export interface ApiSuccess {
    success: true;
    [key: string]: unknown;
}
