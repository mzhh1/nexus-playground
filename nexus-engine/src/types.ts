export interface GameConfig {
    gameWorkerUrl: string;
    maxPlayers: number;
    turnTimeout?: number;
    [key: string]: any;
}

export interface GameState {
    // Generic state holder
    [key: string]: any;
}

export interface Player {
    userId: string;
    role: string | null;
    connected: boolean;
    ws?: WebSocket;
}

// Token Payload Structure
export interface TokenPayload {
    roomId: string;
    userId: string;
    role: string;
    exp: number;
    iat: number;
}
