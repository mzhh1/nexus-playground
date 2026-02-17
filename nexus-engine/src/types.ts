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
export type RoomPhase = 'lobby' | 'playing' | 'finished';

// ─── Engine Internal State ──────────────────────────────────

/** Game configuration — set when owner selects a game */
export interface GameConfig {
    gameWorkerUrl: string;
    gameId: string;
    maxPlayers: number;
    roleIds: string[];
    [key: string]: any;
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
    roleId: string;
    action: { actionId: string; params: Record<string, any> };
    timestamp: number;
}

/** Full internal state persisted in DO storage */
export interface EngineRoomState {
    roomId: string;
    ownerId: string;
    phase: RoomPhase;
    players: Record<string, PlayerInfo>; // key = userId
    gameConfig: GameConfig | null;
    roleMapping: Record<string, string>; // roleId → userId
    gameState: any | null;
    history: HistoryEvent[];
    llmWebhookUrl: string | null;
}

// ─── Client-facing State (sanitised, pushed via WS) ─────────

/** Per-player view in the client engine state */
export interface ClientPlayerInfo {
    displayName: string;
    connected: boolean;
    isOwner: boolean;
    type: 'human' | 'llm';
    role: string | null;
}

/** Engine state visible to the client */
export interface ClientEngineState {
    roomId: string;
    phase: RoomPhase;
    players: Record<string, ClientPlayerInfo>;
    gameConfig: {
        gameId: string;
        maxPlayers: number;
        roleIds: string[];
    } | null;
    you: {
        userId: string;
        isOwner: boolean;
        role: string | null;
    };
}

// ─── WebSocket Protocol ─────────────────────────────────────

/** Messages sent from server to client */
export type ServerMessage =
    | { type: 'SYNC_STATE'; payload: { engine: ClientEngineState; game: any | null } }
    | { type: 'ERROR'; payload: string }
    | { type: 'KICKED'; payload: string };

/** Messages sent from client to server */
export type ClientMessage =
    // Lobby
    | { type: 'LOBBY_SELECT_ROLE'; payload: { roleId: string | null } }
    | { type: 'LOBBY_LEAVE' }
    // Admin (owner only)
    | { type: 'ADMIN_SET_GAME'; payload: { gameId: string; gameWorkerUrl: string } }
    | { type: 'ADMIN_ADD_BOT'; payload: { displayName: string; modelName: string; systemPrompt?: string; temperature?: number } }
    | { type: 'ADMIN_REMOVE_PLAYER'; payload: { userId: string } }
    | { type: 'ADMIN_ASSIGN_ROLE'; payload: { roleId: string; userId: string } }
    | { type: 'ADMIN_START_GAME' }
    | { type: 'ADMIN_STOP_GAME' }
    | { type: 'ADMIN_RESTART_GAME' }
    | { type: 'ADMIN_PAUSE_GAME' }
    | { type: 'ADMIN_RESUME_GAME' }
    // Game action
    | { type: 'ACT'; payload: { actionId: string; params?: Record<string, any> } };

// ─── LLM Webhook Types ──────────────────────────────────────

/** Request body sent to Backend's LLM webhook endpoint */
export interface LlmWebhookRequest {
    roomId: string;
    roleId: string;
    gameId: string;
    perspective: any; // RolePerspective from Game Worker
    llmConfig: LlmConfig;
    attempt: number;
    maxAttempts: number;
    previousError?: string;
}

/** Response from Backend's LLM webhook endpoint */
export interface LlmWebhookResponse {
    action: {
        actionId: string;
        params: Record<string, any>;
    };
    memoryUpdate?: {
        mode: 'append' | 'replace';
        content: string;
    };
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
    ADMIN_SECRET: string;
    JWT_SECRET: string;
    LLM_WEBHOOK_URL?: string;
    LLM_WEBHOOK_SECRET?: string;
}
