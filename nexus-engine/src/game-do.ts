import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { sign } from "hono/jwt";
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
    StateHistoryEntry,
} from "./types";
import { resolveGameWorkerClient } from "./runtime/game-worker-client";
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
export class GameDO extends DurableObject<Env> implements IRoomContext {
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
    public name: string = "";
    public isPublic: boolean = true;
    public phase: RoomPhase = "lobby";
    public players: Record<string, PlayerInfo> = {};
    public gameConfig: GameConfig | null = null;
    public roleMapping: Record<string, string> = {};
    public gameState: any | null = null;
    public history: HistoryEvent[] = [];
    public stateHistory: StateHistoryEntry[] = [];
    public runtimeId: string = "";
    public stateIndex: number = 0;
    public llmWebhookUrl: string | null = null;
    public roomMetaHookUrl: string | null = null;

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
        this.name = (await s.get("name")) || "";
        this.isPublic = (await s.get("isPublic")) ?? true;
        this.phase = (await s.get("phase")) || "lobby";
        this.players = (await s.get("players")) || {};
        this.gameConfig = (await s.get("gameConfig")) || null;
        this.roleMapping = (await s.get("roleMapping")) || {};
        this.gameState = (await s.get("gameState")) || null;
        this.history = (await s.get("history")) || [];
        this.stateHistory = (await s.get("stateHistory")) || [];
        this.runtimeId = (await s.get("runtimeId")) || "";
        this.stateIndex = (await s.get("stateIndex")) || 0;
        this.llmWebhookUrl = this.bindings.LLM_WEBHOOK_URL || (await s.get("llmWebhookUrl")) || null;
        this.roomMetaHookUrl = (await s.get("roomMetaHookUrl")) || null;
    }

    public async persistAll(): Promise<void> {
        await this.ctx.storage.put({
            roomId: this.roomId,
            ownerId: this.ownerId,
            ownerDisplayName: this.ownerDisplayName,
            name: this.name,
            isPublic: this.isPublic,
            phase: this.phase,
            players: this.players,
            gameConfig: this.gameConfig,
            roleMapping: this.roleMapping,
            gameState: this.gameState,
            history: this.history,
            stateHistory: this.stateHistory,
            runtimeId: this.runtimeId,
            stateIndex: this.stateIndex,
            llmWebhookUrl: this.llmWebhookUrl,
            roomMetaHookUrl: this.roomMetaHookUrl,
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
        this.app.post("/delete", async (c) => {
            await this.ctx.storage.deleteAll();
            return c.json({ success: true, deleted: true });
        });

        this.app.post("/init", async (c) => {
            const body = await c.req.json<{
                roomId?: string;
                ownerId: string;
                ownerDisplayName?: string;
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
            this.name = `${this.ownerDisplayName}的房间`;
            this.isPublic = true;
            this.phase = "lobby";
            this.players = {};
            this.roleMapping = {};
            this.gameState = null;
            this.history = [];
            this.stateHistory = [];
            this.runtimeId = "";
            this.stateIndex = 0;
            this.llmWebhookUrl = this.bindings.LLM_WEBHOOK_URL || null;
            this.gameConfig = null;
            this.roomMetaHookUrl = (body as any).roomMetaHookUrl || null;

            await this.persistAll();
            this.ctx.waitUntil(this.syncRoomMeta());
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

        this.app.get("/state", async (c) => {
            return c.json({
                roomId: this.roomId,
                ownerId: this.ownerId,
                ownerDisplayName: this.ownerDisplayName,
                name: this.name,
                isPublic: this.isPublic,
                phase: this.phase,
                players: this.players,
                gameConfig: this.gameConfig,
                roleMapping: this.roleMapping,
                gameState: this.gameState,
                history: this.history,
                stateHistory: this.stateHistory,
                runtimeId: this.runtimeId,
                stateIndex: this.stateIndex,
                llmWebhookUrl: this.llmWebhookUrl,
                roomMetaHookUrl: this.roomMetaHookUrl,
                // Meta info
                metadata: {
                    connectedCount: this.connections.size,
                    storageUsage: await this.ctx.storage.getAlarm() !== null ? "has_alarm" : "no_alarm",
                }
            } as EngineRoomState & { metadata: any });
        });

        this.app.get("/perspective", async (c) => {
            const roleId = c.req.query("roleId");
            if (!roleId) return c.json({ error: "roleId required" }, 400);
            const perspective = await this.fetchPerspective(roleId);
            return c.json({ data: perspective });
        });

        this.app.post("/role-action", async (c) => {
            const body = await c.req.json<{
                roleId: string;
                action: { action_id: string; params: any };
            }>();
            if (!body.roleId || !body.action) return c.json({ error: "roleId and action required" }, 400);
            const res = await this.submitActionToGameWorker(body.roleId, body.action);
            if (res.success && res.nextState) {
                this.history.push({
                    turn: (this.history[this.history.length - 1]?.turn || 0) + 1,
                    roleId: body.roleId,
                    action: body.action,
                    timestamp: Date.now(),
                    stateIndex: this.stateIndex,
                });
                this.gameState = res.nextState;
                this.stateIndex++;
                await this.persist("gameState", "history", "stateIndex");
                this.presence.broadcastSyncState();
            }
            return c.json(res);
        });

        // ─── Admin HTTP Endpoints (no WebSocket, bypasses requireOwner) ───

        this.app.post("/set-game", async (c) => {
            const body = await c.req.json<{ gameWorkerUrl: string; gameId?: string; selectedPlayerCount?: number }>();
            if (!body.gameWorkerUrl) return c.json({ error: "gameWorkerUrl is required" }, 400);

            if (this.phase !== "lobby" && this.phase !== "finished") {
                return c.json({ error: "Can only set game in lobby/finished phase" }, 400);
            }

            try {
                const baseUrl = body.gameWorkerUrl.replace(/\/$/, "");
                const client = resolveGameWorkerClient(body.gameId || "", baseUrl, this.bindings);

                const metaRes = await client.fetch("/metadata");
                if (!metaRes.ok) {
                    const errText = await metaRes.text();
                    console.error("[GameDO] Metadata fetch failed. Status:", metaRes.status, "Body:", errText);
                    return c.json({ error: "Failed to fetch game metadata" }, 502);
                }
                const metadata = await metaRes.json() as GameWorkerMetadata;

                let roleIds: string[];
                let resolvedPlayerCount: number | undefined;
                if (Array.isArray(metadata.roleIds)) {
                    roleIds = metadata.roleIds;
                    resolvedPlayerCount = roleIds.length;
                } else if (metadata.roleIds) {
                    const counts = Object.keys(metadata.roleIds).map(Number).sort((a, b) => a - b);
                    const selectedCount = body.selectedPlayerCount;
                    const effectiveCount = selectedCount && metadata.roleIds[selectedCount]
                        ? selectedCount : counts[0];
                    roleIds = metadata.roleIds[effectiveCount] || [];
                    resolvedPlayerCount = effectiveCount;
                } else {
                    roleIds = [];
                }

                this.gameConfig = {
                    gameWorkerUrl: baseUrl,
                    gameId: body.gameId || metadata.id,
                    maxPlayers: roleIds.length,
                    roleIds,
                    selectedPlayerCount: resolvedPlayerCount,
                    enable_llm_memory: metadata.enable_llm_memory,
                    auto_save_mode: metadata.auto_save_mode,
                };
                this.roleMapping = {};

                await this.persist("gameConfig", "roleMapping");
                this.presence.broadcastSyncState();
                this.ctx.waitUntil(this.syncRoomMeta());
                return c.json({ success: true, gameId: this.gameConfig.gameId, roleIds });
            } catch (e: any) {
                console.error("[GameDO] /set-game failed:", e);
                return c.json({ error: e.message || "Failed to set game" }, 500);
            }
        });

        this.app.post("/start-game", async (c) => {
            if (this.phase !== "lobby" && this.phase !== "finished") {
                return c.json({ error: "Game cannot be started in current phase" }, 400);
            }
            if (!this.gameConfig) {
                return c.json({ error: "No game selected" }, 400);
            }

            // Auto-create virtual dev players for unassigned roles
            for (const roleId of this.gameConfig.roleIds) {
                if (!this.roleMapping[roleId]) {
                    const devUserId = `dev:${roleId}`;
                    this.players[devUserId] = {
                        displayName: roleId,
                        connected: false,
                        isOwner: false,
                        type: "human",
                    };
                    this.roleMapping[roleId] = devUserId;
                }
            }

            try {
                for (const player of Object.values(this.players)) {
                    if (player.type === "llm" && player.llmConfig) {
                        player.llmConfig.memory = "";
                    }
                }

                const client = resolveGameWorkerClient(
                    this.gameConfig.gameId,
                    this.gameConfig.gameWorkerUrl,
                    this.bindings,
                );
                const initRes = await client.fetch("/init", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ players: this.gameConfig.roleIds }),
                });
                if (!initRes.ok) {
                    const errText = await initRes.text();
                    return c.json({ error: `Game Worker init failed: ${errText}` }, 502);
                }

                this.gameState = await initRes.json();
                this.history = [];
                this.runtimeId = crypto.randomUUID();
                this.stateIndex = 0;
                this.stateHistory = [{
                    index: 0,
                    name: "Initial State",
                    state: this.gameState,
                    timestamp: Date.now(),
                }];
                this.phase = "playing";

                await this.persistAll();
                this.presence.broadcastSyncState();
                await this.checkAndTriggerNextTurn();
                this.ctx.waitUntil(this.syncRoomMeta());
                return c.json({ success: true, phase: this.phase });
            } catch (e: any) {
                console.error("[GameDO] /start-game failed:", e);
                return c.json({ error: e.message || "Failed to start game" }, 500);
            }
        });

        this.app.post("/stop-game", async (c) => {
            if (this.phase === "lobby") {
                return c.json({ error: "Game has not started" }, 400);
            }

            this.phase = "lobby";
            this.gameState = null;
            this.history = [];
            this.stateHistory = [];

            await this.persist("phase", "gameState", "history", "stateHistory");
            this.presence.broadcastSyncState();
            this.ctx.waitUntil(this.syncRoomMeta());
            return c.json({ success: true, phase: this.phase });
        });

        this.app.post("/restart-game", async (c) => {
            if (this.phase !== "playing" && this.phase !== "paused" && this.phase !== "finished") {
                return c.json({ error: "Nothing to restart" }, 400);
            }
            if (!this.gameConfig) {
                return c.json({ error: "No game selected" }, 400);
            }

            try {
                for (const player of Object.values(this.players)) {
                    if (player.type === "llm" && player.llmConfig) {
                        player.llmConfig.memory = "";
                    }
                }

                const client = resolveGameWorkerClient(
                    this.gameConfig.gameId,
                    this.gameConfig.gameWorkerUrl,
                    this.bindings,
                );
                const initRes = await client.fetch("/init", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ players: Object.keys(this.roleMapping) }),
                });
                if (!initRes.ok) {
                    return c.json({ error: "Game Worker init failed on restart" }, 502);
                }

                this.gameState = await initRes.json();
                this.history = [];
                this.runtimeId = crypto.randomUUID();
                this.stateIndex = 0;
                this.stateHistory = [{
                    index: 0,
                    name: "Initial State",
                    state: this.gameState,
                    timestamp: Date.now(),
                }];
                this.phase = "playing";

                await this.persistAll();
                this.presence.broadcastSyncState();
                await this.checkAndTriggerNextTurn();
                this.ctx.waitUntil(this.syncRoomMeta());
                return c.json({ success: true, phase: this.phase });
            } catch (e: any) {
                console.error("[GameDO] /restart-game failed:", e);
                return c.json({ error: e.message || "Failed to restart game" }, 500);
            }
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
            case "LOBBY_JOIN_REQUEST":
                // Forward to owner
                const ownerWs = this.sessions.get(this.ownerId);
                if (ownerWs) {
                    this.sendMessage(ownerWs, {
                        type: "JOIN_REQUEST_INTERNAL",
                        payload: { userId, displayName: msg.payload.displayName },
                    });
                }
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
            case "ADMIN_APPROVE_JOIN":
                await this.roomMgr.handleAdminApproveJoin(userId, msg.payload);
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
                this.ctx.waitUntil(this.syncRoomMeta());
                break;
            case "ADMIN_RESUME_GAME":
                if (!this.requireOwner(userId)) return;
                this.phase = "playing";
                await this.persist("phase");
                this.presence.broadcastSyncState();
                this.ctx.waitUntil(this.syncRoomMeta());
                this.ctx.waitUntil(this.checkAndTriggerNextTurn());
                break;
            case "ADMIN_BACKTRACK_STATE":
                if (!this.requireOwner(userId)) return;
                if (this.phase !== "paused") {
                    return this.sendErrorToUser(userId, "Game must be paused to backtrack");
                }
                const historyIdx = msg.payload.index;
                const targetState = this.stateHistory.find(h => h.index === historyIdx);
                if (!targetState) {
                    return this.sendErrorToUser(userId, "Invalid state index");
                }
                this.gameState = targetState.state;
                this.stateIndex = targetState.index;
                // history events should also be reverted?
                // logic: if we backtrack to state X, we should keep history up to that point.
                this.history = this.history.filter(h => h.stateIndex <= targetState.index);
                await this.persist("gameState", "history", "stateIndex");
                this.presence.broadcastSyncState();
                break;
            case "ADMIN_UPDATE_ROOM_META":
                if (!this.requireOwner(userId)) return;
                this.name = msg.payload.name;
                this.isPublic = msg.payload.isPublic;
                await this.persist("name", "isPublic");
                this.presence.broadcastSyncState();
                this.ctx.waitUntil(this.syncRoomMeta());
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

    public async syncRoomMeta(): Promise<void> {
        if (!this.roomMetaHookUrl) return;
        try {
            const token = await sign({ roomId: this.roomId, exp: Math.floor(Date.now() / 1000) + 60 }, this.bindings.JWT_SECRET);
            const res = await fetch(this.roomMetaHookUrl, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: this.name,
                    gameId: this.gameConfig?.gameId || null,
                    isPublic: this.isPublic,
                    phase: this.phase,
                })
            });
            if (!res.ok) {
                console.warn(`[GameDO] Failed to sync room meta: ${res.status} ${await res.text()}`);
            }
        } catch (e) {
            console.error("[GameDO] Error syncing room meta:", e);
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

    public waitUntil(promise: Promise<unknown>): void {
        this.ctx.waitUntil(promise);
    }

    // ─── Game RPC Helpers ───────────────────────────────────
    public getGameWorkerBaseUrl(): string {
        return this.gameConfig?.gameWorkerUrl.replace(/\/$/, "") || "";
    }

    public getGameWorkerClient() {
        if (!this.gameConfig) throw new Error("Game config missing");
        return resolveGameWorkerClient(
            this.gameConfig.gameId,
            this.gameConfig.gameWorkerUrl,
            this.bindings
        );
    }

    public async getCurrentRole(): Promise<string | null> {
        if (!this.gameConfig || !this.gameState) return null;
        try {
            const client = this.getGameWorkerClient();
            const res = await client.fetch("/current-role", {
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
            const client = this.getGameWorkerClient();
            const res = await client.fetch("/is-terminal", {
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
            const client = this.getGameWorkerClient();
            const res = await client.fetch("/perspective", {
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

    public async fetchStatePrompt(perspective: any): Promise<string | null> {
        if (!this.gameConfig) return null;
        try {
            const client = this.getGameWorkerClient();
            const res = await client.fetch("/state-prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ perspective }),
            });
            if (!res.ok) {
                console.warn(`[GameDO] fetchStatePrompt: worker returned ${res.status}, falling back to JSON`);
                return null;
            }
            const data = await res.json() as { statePrompt?: string };
            return data.statePrompt || null;
        } catch (e) {
            console.error("[GameDO] Failed to fetch state prompt:", e);
            return null;
        }
    }

    public async submitActionToGameWorker(
        roleId: string,
        action: { action_id: string; params: Record<string, any> },
    ): Promise<{ success: boolean; nextState?: any; error?: string }> {
        if (!this.gameConfig || !this.gameState) return { success: false, error: "Game not initialized" };
        try {
            const client = this.getGameWorkerClient();
            const res = await client.fetch("/action", {
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
            return { success: false, error: "Worker communication failed" + e };
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
