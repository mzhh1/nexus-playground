export interface GameConfig {
    gameWorkerUrl: string;
    maxPlayers: number;
    turnTimeout?: number;
    [key: string]: any;
}

export interface GameState {
    [key: string]: any;
}

/** Room phase: lobby (waiting) or playing (game active) */
export type RoomPhase = 'lobby' | 'playing' | 'finished';

/** A connected player in the DO (role is derived from roleMapping) */
export interface Player {
    userId: string;
    displayName: string;
    connected: boolean;
    isOwner: boolean;           // derived at runtime from ownerId comparison
    ws?: WebSocket;
}

/** Lobby state persisted in DO storage */
export interface LobbyState {
    ownerId: string;
    phase: RoomPhase;
    players: Record<string, { displayName: string }>; // userId -> info
    roleMapping: Record<string, string>;  // roleId -> userId
    gameConfig: GameConfig | null;
}

/** JWT payload structure (HS256) */
export interface TokenPayload {
    sub: string;      // userId
    roomId: string;
    name: string;     // displayName
    iat: number;
    exp: number;
}
