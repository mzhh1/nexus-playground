import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import type {
    Env,
    EngineRoomState,
    PlayerInfo,
    ClientEngineState,
    ClientPlayerInfo,
    ClientMessage,
    ServerMessage,
    GameConfig,
    HistoryEvent,
    MonitorLogRecord,
    LlmWebhookRequest,
    LlmWebhookResponse,
    GameWorkerMetadata,
    GameWorkerActionRequest,
    GameWorkerActionResponse,
    GameWorkerPerspectiveRequest,
    RoomPhase,
    LlmConfig,
} from "./types";
import { insertMonitorLog, updateMonitorLog } from "./monitor-store";
import { IRoomContext } from "./managers/types";
import { PresenceManager } from "./managers/presence";
import { RoomManager } from "./managers/room";
import { GameExecutor } from "./managers/executor";
import { LlmManager } from "./managers/llm";

// ─── Helper: Is this userId an LLM player? ──────────────────
export function isLlmUserId(userId: string): boolean {
    return userId.startsWith("llm:");
}

export function generateLlmUserId(modelName: string): string {
    const uuid = crypto.randomUUID().slice(0, 8);
    return `llm:${modelName}:${uuid}`;
}

// ─── Helper: Get roleId assigned to a userId ────────────────
export function getRoleForUser(
    roleMapping: Record<string, string>,
    userId: string,
): string | null {
    for (const [roleId, uid] of Object.entries(roleMapping)) {
        if (uid === userId) return roleId;
    }
    return null;
}

/**
 * GameDO — The Room Container (Durable Object) v4.0 (Refactored)
 *
 * Manages the room lifecycle by delegating to specialized managers:
 * - PresenceManager: WebSocket sessions and syncing
 * - RoomManager: Lobby, roles and admin
 * - GameExecutor: Game lifecycle and actions
 * - LlmManager: LLM bot logic
 */
export class GameDO extends DurableObject implements IRoomContext {
    public app: Hono = new Hono();
    public bindings: Env;

    // Managers
    private presence: PresenceManager;
    private roomMgr: RoomManager;
    private executor: GameExecutor;
    private llm: LlmManager;

    // ─── Persisted state ────────────────────────────────────
    public roomId: string = "";
    public ownerId: string = "";
    public ownerDisplayName: string = "";
    public phase: RoomPhase = "lobby";
    public players: Record<string, PlayerInfo> = {};
    public gameConfig: GameConfig | null = null;
    public roleMapping: Record<string, string> = {};
    public gameState: any | null = null;
    public history: HistoryEvent[] = [];
    public llmWebhookUrl: string | null = null;

    // ─── In-memory connection tracking ──────────────────────
    public connections: Map<WebSocket, string> = new Map(); // ws → userId
    public sessions: Map<string, WebSocket> = new Map(); // userId → ws

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.bindings = env;

        this.presence = new PresenceManager(this);
        this.roomMgr = new RoomManager(this);
        this.executor = new GameExecutor(this);
        this.llm = new LlmManager(this);

        // Load persisted state on wake
        this.ctx.blockConcurrencyWhile(async () => {
            await this.loadState();
        });

        this.setupRoutes();
    }

    // ═════════════════════════════════════════════════════════
    // State Persistence
    // ═════════════════════════════════════════════════════════

    public async loadState(): Promise<void> {
        const s = this.ctx.storage;
        this.roomId = (await s.get("roomId")) || "";
        this.ownerId = (await s.get("ownerId")) || "";
        this.ownerDisplayName = (await s.get("ownerDisplayName")) || "";
        this.phase = (await s.get("phase")) || "lobby";
        this.players = (await s.get("players")) || {};
        this.gameConfig = (await s.get("gameConfig")) || null;
        this.roleMapping = (await s.get("roleMapping")) || {};
        this.gameState = (await s.get("gameState")) || null;
        this.history = (await s.get("history")) || [];
        this.llmWebhookUrl = this.bindings.LLM_WEBHOOK_URL || (await s.get("llmWebhookUrl")) || null;
    }

    public async persistAll(): Promise<void> {
        await this.ctx.storage.put({
            roomId: this.roomId,
            ownerId: this.ownerId,
            ownerDisplayName: this.ownerDisplayName,
            phase: this.phase,
            players: this.players,
            gameConfig: this.gameConfig,
            roleMapping: this.roleMapping,
            gameState: this.gameState,
            history: this.history,
            llmWebhookUrl: this.llmWebhookUrl,
        });
    }

    public async persist(...keys: (keyof EngineRoomState)[]): Promise<void> {
        const data: Record<string, any> = {};
        for (const key of keys) {
            data[key] = (this as any)[key];
        }
        await this.ctx.storage.put(data);
    }

    // ═════════════════════════════════════════════════════════
    // HTTP Routes
    // ═════════════════════════════════════════════════════════

    private setupRoutes(): void {
        this.app.post("/init", async (c) => {
            const body = await c.req.json<{
                roomId?: string;
                ownerId: string;
                ownerDisplayName?: string;
                gameWorkerUrl?: string;
                config?: any;
                context?: any;
            }>();

            if (this.ownerId === body.ownerId && this.roomId) {
                return c.json({
                    success: true,
                    alreadyInitialized: true,
                    phase: this.phase,
                });
            }

            this.roomId = body.roomId || "";
            this.ownerId = body.ownerId;
            this.ownerDisplayName = body.ownerDisplayName || body.ownerId;
            this.phase = "lobby";
            this.players = {};
            this.roleMapping = {};
            this.gameState = null;
            this.history = [];
            this.llmWebhookUrl = this.bindings.LLM_WEBHOOK_URL || null;

            if (body.gameWorkerUrl) {
                this.gameConfig = {
                    gameWorkerUrl: body.gameWorkerUrl,
                    gameId: body.context?.gameId || "",
                    maxPlayers: body.config?.maxPlayers || 2,
                    roleIds: body.config?.players || [],
                    ...body.config,
                };
            } else {
                this.gameConfig = null;
            }

            await this.persistAll();
            return c.json({ success: true });
        });

        this.app.get("/websocket", async (c) => {
            const upgradeHeader = c.req.header("Upgrade");
            if (!upgradeHeader || upgradeHeader !== "websocket") {
                return c.text("Expected Upgrade: websocket", 426);
            }

            const userId = c.req.query("userId") || "";
            const displayName = c.req.query("displayName") || userId;

            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            await this.presence.handleSession(server, userId, displayName);

            return new Response(null, { status: 101, webSocket: client });
        });

        this.app.get("/debug", async (c) => {
            return c.json({
                roomId: this.roomId,
                ownerId: this.ownerId,
                phase: this.phase,
                playerCount: Object.keys(this.players).length,
                connectedCount: this.connections.size,
                gameConfig: this.gameConfig
                    ? { gameId: this.gameConfig.gameId, maxPlayers: this.gameConfig.maxPlayers }
                    : null,
                roleMapping: this.roleMapping,
                hasGameState: this.gameState != null,
                historyLength: this.history.length,
            });
        });
    }

    async fetch(request: Request): Promise<Response> {
        return this.app.fetch(request);
    }

    // ═════════════════════════════════════════════════════════
    // Lifecycle & Delegation
    // ═════════════════════════════════════════════════════════

    public async handleMessage(userId: string, msg: ClientMessage): Promise<void> {
        console.log(`[GameDO] Incoming message from ${userId}: ${msg.type}`);
        switch (msg.type) {
            case "LOBBY_SELECT_ROLE":
                await this.roomMgr.handleSelectRole(userId, msg.payload.roleId);
                break;
            case "LOBBY_LEAVE":
                await this.roomMgr.handleLeave(userId);
                break;
            case "ADMIN_SET_GAME":
                await this.roomMgr.handleAdminSetGame(userId, msg.payload);
                break;
            case "ADMIN_ADD_BOT":
                await this.llm.handleAdminAddBot(userId, msg.payload);
                break;
            case "ADMIN_REMOVE_PLAYER":
                await this.roomMgr.handleAdminRemovePlayer(userId, msg.payload.userId);
                break;
            case "ADMIN_ASSIGN_ROLE":
                await this.roomMgr.handleAdminAssignRole(userId, msg.payload);
                break;
            case "ADMIN_START_GAME":
                await this.executor.handleAdminStartGame(userId);
                break;
            case "ADMIN_STOP_GAME":
                await this.executor.handleAdminStopGame(userId);
                break;
            case "ADMIN_RESTART_GAME":
                await this.executor.handleAdminRestartGame(userId);
                break;
            case "ADMIN_PAUSE_GAME":
                if (!this.requireOwner(userId)) return;
                this.phase = "paused";
                await this.persist("phase");
                this.presence.broadcastSyncState();
                break;
            case "ADMIN_RESUME_GAME":
                if (!this.requireOwner(userId)) return;
                this.phase = "playing";
                await this.persist("phase");
                this.presence.broadcastSyncState();
                this.ctx.waitUntil(this.checkAndTriggerNextTurn());
                break;
            case "ACT":
                await this.executor.handleAction(userId, msg.payload);
                break;
            default:
                this.presence.sendErrorToUser(userId, `Unknown message type: ${(msg as any).type}`);
        }
    }

    public async checkAndTriggerNextTurn(): Promise<void> {
        if (this.phase !== "playing") {
            console.log(`[GameDO] checkAndTriggerNextTurn: skipping because phase is ${this.phase}`);
            return;
        }

        const roleId = await this.getCurrentRole();
        console.log(`[GameDO] Current role identified as: ${roleId}`);
        if (!roleId) return;

        const userId = this.roleMapping[roleId];
        const player = this.players[userId];
        console.log(`[GameDO] roleId ${roleId} is mapped to userId ${userId}. Player info:`, player ? JSON.stringify(player) : "null");

        if (player && player.type === "llm") {
            console.log(`[GameDO] Triggering LLM turn for ${roleId} (${userId})`);
            this.ctx.waitUntil(this.llm.callLlmWebhook(roleId));
        } else {
            console.log(`[GameDO] Next turn is for human player or player not found. Standing by.`);
        }
    }

    // ─── Forwarding methods for managers ────────────────────
    public broadcastSyncState() { this.presence.broadcastSyncState(); }
    public sendMessage(ws: WebSocket, msg: ServerMessage) { this.presence.sendMessage(ws, msg); }
    public sendErrorToUser(userId: string, msg: string) { this.presence.sendErrorToUser(userId, msg); }

    public requireOwner(userId: string): boolean {
        if (userId !== this.ownerId) {
            this.sendErrorToUser(userId, "Only the room owner can perform this action");
            return false;
        }
        return true;
    }

    // ─── Game RPC Helpers ───────────────────────────────────
    public getGameWorkerBaseUrl(): string {
        return this.gameConfig?.gameWorkerUrl.replace(/\/$/, "") || "";
    }

    public async getCurrentRole(): Promise<string | null> {
        if (!this.gameConfig || !this.gameState) return null;
        try {
            const res = await fetch(`${this.getGameWorkerBaseUrl()}/current-role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: this.gameState }),
            });
            if (!res.ok) {
                console.error(`[GameDO] getCurrentRole: worker returned ${res.status}`);
                return null;
            }
            const data = await res.json() as any;
            const roleId = data.roleId || data.role_id || data;
            console.log(`[GameDO] getCurrentRole: worker returned ${JSON.stringify(data)}, extracted: ${roleId}`);
            return roleId;
        } catch (e) {
            console.error("[GameDO] Failed to get current role:", e);
            return null;
        }
    }

    public async isTerminal(): Promise<boolean> {
        if (!this.gameConfig || !this.gameState) return true;
        try {
            const res = await fetch(`${this.getGameWorkerBaseUrl()}/is-terminal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: this.gameState }),
            });
            if (!res.ok) return true;
            const data = await res.json() as any;
            return data === true || data.terminal === true || data.isTerminal === true;
        } catch (e) {
            console.error("[GameDO] Failed to check terminal state:", e);
            return true;
        }
    }

    public async fetchPerspective(roleId: string): Promise<any | null> {
        if (!this.gameConfig || !this.gameState) return null;
        try {
            const res = await fetch(`${this.getGameWorkerBaseUrl()}/perspective`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: this.gameState,
                    roleId,
                    wholeHistory: this.history,
                    diffHistory: this.calculateDiffHistory(roleId),
                }),
            });
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("[GameDO] Failed to fetch perspective:", e);
            return null;
        }
    }

    public async submitActionToGameWorker(
        roleId: string,
        action: { action_id: string; params: Record<string, any> },
    ): Promise<{ success: boolean; nextState?: any; error?: string }> {
        if (!this.gameConfig || !this.gameState) return { success: false, error: "Game not initialized" };
        try {
            const res = await fetch(`${this.getGameWorkerBaseUrl()}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: this.gameState,
                    action: { ...action, role_id: roleId },
                }),
            });
            if (!res.ok) {
                const text = await res.text();
                return { success: false, error: text };
            }
            const data = await res.json() as any;
            return {
                success: data.success,
                nextState: data.nextState,
                error: data.error,
            };
        } catch (e) {
            console.error("[GameDO] Worker action failed:", e);
            return { success: false, error: "Worker communication failed" };
        }
    }

    public calculateDiffHistory(roleId: string): HistoryEvent[] {
        let lastIndex = -1;
        for (let i = this.history.length - 1; i >= 0; i--) {
            if (this.history[i].roleId === roleId) {
                lastIndex = i;
                break;
            }
        }
        if (lastIndex === -1) return [...this.history];
        return this.history.slice(lastIndex);
    }

    public applyMemoryUpdate(
        currentMemory: string,
        update: { mode: "append" | "replace"; content: string },
    ): string {
        if (update.mode === "replace") return update.content;
        return currentMemory ? `${currentMemory}\n${update.content}` : update.content;
    }

    public async sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
