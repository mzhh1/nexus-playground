// ============================================================
// Nexus Engine Type Definitions — v4.0 Heavy Engine
// ============================================================

// ─── ID Conventions ─────────────────────────────────────────
// userId:  Global unique from OAuth JWT `sub` (e.g. "google_123")
//          LLM players use synthetic IDs: "llm:<model>:<uuid8>"
// roomId:  From Backend Postgres (e.g. "9uTr5rTB")
// roleId:  From Game Worker metadata (e.g. "black", "white")
// ─────────────────────────────────────────────────────────────

/** Room lifecycle phase */
export type RoomPhase = 'lobby' | 'playing' | 'paused' | 'finished';

// ─── Engine Internal State ──────────────────────────────────

/** Game configuration — set when owner selects a game */
export interface GameConfig {
    gameWorkerUrl: string;
    gameId: string;
    maxPlayers: number;
    roleIds: string[];
    selectedPlayerCount?: number;
    enable_llm_memory?: boolean;
    auto_save_mode?: 'enabled' | 'disabled';
    [key: string]: any;
}

export interface StateHistoryEntry {
    index: number;
    name: string;
    state: any;
    timestamp: number;
}

/** LLM-specific configuration for a bot player */
export interface LlmConfig {
    modelName: string;
    systemPrompt: string;
    temperature: number;
    memory: string;
}

/** Information about a player in the room */
export interface PlayerInfo {
    displayName: string;
    connected: boolean;
    isOwner: boolean;
    type: 'human' | 'llm';
    /** Present only when type === 'llm' */
    llmConfig?: LlmConfig;
}

/** A single history event recording an action */
export interface HistoryEvent {
    turn: number;
    stateIndex: number;
    roleId: string;
    action: { action_id: string; params: Record<string, any> };
    timestamp: number;
}

/** Full internal state persisted in DO storage */
export interface EngineRoomState {
    roomId: string;
    ownerId: string;
    ownerDisplayName: string;
    name: string;
    isPublic: boolean;
    phase: RoomPhase;
    players: Record<string, PlayerInfo>; // key = userId
    gameConfig: GameConfig | null;
    roleMapping: Record<string, string>; // roleId → userId
    gameState: any | null;
    history: HistoryEvent[];
    stateHistory: StateHistoryEntry[];
    runtimeId: string;
    stateIndex: number;
    llmWebhookUrl: string | null;
    roomMetaHookUrl?: string | null;
}

// ─── Client-facing State (sanitised, pushed via WS) ─────────

/** Per-player view in the client engine state */
export interface ClientPlayerInfo {
    displayName: string;
    connected: boolean;
    isOwner: boolean;
    type: 'human' | 'llm';
    role: string | null;
    modelName?: string;
}

/** Engine state visible to the client */
export interface ClientEngineState {
    roomId: string;
    ownerId: string;
    ownerDisplayName: string;
    name: string;
    isPublic: boolean;
    phase: RoomPhase;
    players: Record<string, ClientPlayerInfo>;
    gameConfig: {
        gameId: string;
        maxPlayers: number;
        roleIds: string[];
        auto_save_mode?: 'enabled' | 'disabled';
    } | null;
    stateHistory: Omit<StateHistoryEntry, 'state'>[];
    runtimeId: string;
    stateIndex: number;
    you: {
        userId: string;
        isOwner: boolean;
        role: string | null;
        isAuthorized: boolean;
    };
}

// ─── WebSocket Protocol ─────────────────────────────────────

/** Messages sent from server to client */
export type ServerMessage =
    | { type: 'SYNC_STATE'; payload: { engine: ClientEngineState; game: any | null } }
    | { type: 'ERROR'; payload: string }
    | { type: 'KICKED'; payload: string }
    | { type: 'JOIN_REQUEST_INTERNAL'; payload: { userId: string; displayName: string } };

/** Messages sent from client to server */
export type ClientMessage =
    // Lobby
    | { type: 'LOBBY_SELECT_ROLE'; payload: { roleId: string | null } }
    | { type: 'LOBBY_LEAVE' }
    | { type: 'LOBBY_JOIN_REQUEST'; payload: { displayName: string } }
    // Admin (owner only)
    | {
        type: 'ADMIN_SET_GAME';
        payload: { gameId: string; gameWorkerUrl: string; selectedPlayerCount?: number };
    }
    | { type: 'ADMIN_ADD_BOT'; payload: { displayName: string; modelName: string; systemPrompt?: string; temperature?: number } }
    | { type: 'ADMIN_REMOVE_PLAYER'; payload: { userId: string } }
    | { type: 'ADMIN_APPROVE_JOIN'; payload: { userId: string; displayName: string } }
    | { type: 'ADMIN_ASSIGN_ROLE'; payload: { roleId: string; userId: string } }
    | { type: 'ADMIN_START_GAME' }
    | { type: 'ADMIN_STOP_GAME' }
    | { type: 'ADMIN_RESTART_GAME' }
    | { type: 'ADMIN_PAUSE_GAME' }
    | { type: 'ADMIN_RESUME_GAME' }
    | { type: 'ADMIN_BACKTRACK_STATE'; payload: { index: number } }
    | { type: 'ADMIN_UPDATE_ROOM_META'; payload: { name: string; isPublic: boolean } }
    // Game action
    | { type: 'ACT'; payload: { action_id: string; params?: Record<string, any> } };

// ─── LLM Webhook Types ──────────────────────────────────────

/** Request body sent to Backend's LLM webhook endpoint */
export interface LlmWebhookRequest {
    roomId: string;
    roleId: string;
    gameId: string;
    perspective: any; // RolePerspective from Game Worker
    statePrompt?: string;
    llmConfig: LlmConfig;
    attempt: number;
    maxAttempts: number;
    previousError?: string;
}

/** Raw response from the simplified backend proxy */
export interface LlmProxyResponse {
    content: string;
}

/** Parsed result of LLM output - processed internally by LlmManager */
export interface LlmWebhookResponse {
    action: {
        action_id: string;
        params: Record<string, any>;
    };
    memoryUpdate?: {
        mode: 'append' | 'replace';
        content: string;
    };
}

// ─── Monitor Log Types ──────────────────────────────────────

export type PlayerType = 'llm' | 'human';

export type InteractionStatus =
    | 'pending'
    | 'retrying'
    | 'success'
    | 'failed'
    | 'rejected';

export interface MonitorLogRecord {
    interaction_id: string;
    interaction_group_id: string;
    room_id: string;
    game_id: string | null;
    game_name: string | null;
    role_id: string;
    user_id: string | null;
    player_type: PlayerType;
    model_name: string | null;
    system_prompt: string | null;
    user_prompt: string | null;
    response: string | null;
    action_id: string | null;
    action_params_json: string | null;
    status: InteractionStatus;
    attempt: number;
    outer_attempt: number;
    max_attempts: number;
    previous_error: string | null;
    error_message: string | null;
    response_time_ms: number | null;
    event_ts: number;
    created_at: string;
    updated_at: string;
}

export interface MonitorListFilters {
    roomId: string;
    playerType?: PlayerType;
    status?: InteractionStatus;
    gameId?: string;
    roleId?: string;
    startDate?: string;
    endDate?: string;
    order: 'asc' | 'desc';
}

export interface MonitorListResponse {
    data: MonitorLogRecord[];
    pagination: {
        limit: number;
        offset: number;
        count: number;
        hasMore: boolean;
    };
    filters: MonitorListFilters;
}

export interface MonitorStreamEvent {
    kind: 'upsert';
    data: MonitorLogRecord;
}

// ─── JWT ─────────────────────────────────────────────────────

/** JWT payload structure (HS256) */
export interface TokenPayload {
    sub: string;      // userId
    roomId: string;
    name: string;     // displayName
    iat: number;
    exp: number;
}

// ─── Game Worker RPC Types ───────────────────────────────────

/** Response from Game Worker GET /metadata */
export interface GameWorkerMetadata {
    id: string;
    name: string;
    roleIds: string[] | Record<number, string[]>;
    maxPlayers?: number;
    minPlayers?: number;
    enable_llm_memory?: boolean;
    auto_save_mode?: 'enabled' | 'disabled';
    [key: string]: any;
}

/** Request to Game Worker POST /init */
export interface GameWorkerInitRequest {
    players: string[]; // roleIds
    config?: any;
}

/** Request to Game Worker POST /action */
export interface GameWorkerActionRequest {
    state: any;
    action: {
        action_id: string;
        params: Record<string, any>;
        role_id: string;
    };
}

/** Response from Game Worker POST /action */
export interface GameWorkerActionResponse {
    success: boolean;
    nextState?: any;
    error?: string;
    errorCode?: string;
    commands?: { type: 'SAVE_STATE'; name: string } | { type: 'CLEAR_HISTORY' }[];
}

/** Request to Game Worker POST /perspective */
export interface GameWorkerPerspectiveRequest {
    state: any;
    roleId: string;
    wholeHistory: HistoryEvent[];
    diffHistory: HistoryEvent[];
}

/** Request to Game Worker POST /current-role */
export interface GameWorkerCurrentRoleRequest {
    state: any;
}

/** Request to Game Worker POST /is-terminal */
export interface GameWorkerIsTerminalRequest {
    state: any;
}

// ─── Env Bindings ────────────────────────────────────────────

export interface Env {
    GAME_DO: DurableObjectNamespace;
    MONITOR_DO?: DurableObjectNamespace;
    DB?: D1Database;
    ADMIN_SECRET: string;
    JWT_SECRET: string;
    LLM_WEBHOOK_URL?: string;
    LLM_WEBHOOK_SECRET?: string;
    /** Game Service Bindings (e.g. GAME_GOMOKU) */
    [key: string]: any;
}
