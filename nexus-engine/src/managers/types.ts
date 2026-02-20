import { RoomPhase, PlayerInfo, GameConfig, HistoryEvent, Env, EngineRoomState } from "../types";

export interface IRoomContext {
    roomId: string;
    ownerId: string;
    ownerDisplayName: string;
    phase: RoomPhase;
    players: Record<string, PlayerInfo>;
    gameConfig: GameConfig | null;
    roleMapping: Record<string, string>;
    gameState: any | null;
    history: HistoryEvent[];
    llmWebhookUrl: string | null;
    bindings: Env;

    requireOwner(userId: string): boolean;

    connections: Map<WebSocket, string>;
    sessions: Map<string, WebSocket>;

    persist(...keys: (keyof EngineRoomState)[]): Promise<void>;
    persistAll(): Promise<void>;

    // Some methods that managers might call on each other via the room
    handleMessage(userId: string, msg: any): Promise<void>;
    fetchPerspective(roleId: string): Promise<any | null>;
    getCurrentRole(): Promise<string | null>;
    submitActionToGameWorker(roleId: string, action: any): Promise<any>;
    checkAndTriggerNextTurn(): Promise<void>;
    publishMonitorEvent(record: any): Promise<void>;

    broadcastSyncState(): void;
    sendErrorToUser(userId: string, msg: string): void;
    sendMessage(ws: WebSocket, msg: any): void;
    applyMemoryUpdate(currentMemory: string, update: any): string;
    sleep(ms: number): Promise<void>;
}
