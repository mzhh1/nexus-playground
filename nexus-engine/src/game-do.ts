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
    LlmWebhookRequest,
    LlmWebhookResponse,
    GameWorkerMetadata,
    GameWorkerActionRequest,
    GameWorkerActionResponse,
    GameWorkerPerspectiveRequest,
    RoomPhase,
    LlmConfig,
} from "./types";

// ─── Helper: Is this userId an LLM player? ──────────────────
function isLlmUserId(userId: string): boolean {
    return userId.startsWith("llm:");
}

function generateLlmUserId(modelName: string): string {
    const uuid = crypto.randomUUID().slice(0, 8);
    return `llm:${modelName}:${uuid}`;
}

// ─── Helper: Get roleId assigned to a userId ────────────────
function getRoleForUser(
    roleMapping: Record<string, string>,
    userId: string,
): string | null {
    for (const [roleId, uid] of Object.entries(roleMapping)) {
        if (uid === userId) return roleId;
    }
    return null;
}

/**
 * GameDO — The Room Container (Durable Object) v4.0
 *
 * Manages the FULL lifecycle of a room:
 *   LOBBY (players join, select roles, owner configures)
 *   → PLAYING (game active, actions processed)
 *   → FINISHED (game ended, can restart)
 *
 * Single source of truth — no Redis, no external state.
 */
export class GameDO extends DurableObject {
    private app: Hono = new Hono();
    private env: Env;

    // ─── Persisted state ────────────────────────────────────
    private roomId: string = "";
    private ownerId: string = "";
    private ownerDisplayName: string = "";
    private phase: RoomPhase = "lobby";
    private players: Record<string, PlayerInfo> = {};
    private gameConfig: GameConfig | null = null;
    private roleMapping: Record<string, string> = {};
    private gameState: any | null = null;
    private history: HistoryEvent[] = [];
    private llmWebhookUrl: string | null = null;

    // ─── In-memory connection tracking ──────────────────────
    private connections: Map<WebSocket, string> = new Map(); // ws → userId
    private sessions: Map<string, WebSocket> = new Map(); // userId → ws

    constructor(state: DurableObjectState, env: Env) {
        super(state, env);
        this.env = env;

        // Load persisted state on wake
        this.ctx.blockConcurrencyWhile(async () => {
            await this.loadState();
        });

        this.setupRoutes();
    }

    // ═════════════════════════════════════════════════════════
    // State Persistence
    // ═════════════════════════════════════════════════════════

    private async loadState(): Promise<void> {
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
        this.llmWebhookUrl = (await s.get("llmWebhookUrl")) || null;
    }

    private async persistAll(): Promise<void> {
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

    private async persist(...keys: (keyof EngineRoomState)[]): Promise<void> {
        const data: Record<string, any> = {};
        for (const key of keys) {
            data[key] = (this as any)[key];
        }
        await this.ctx.storage.put(data);
    }

    // ═════════════════════════════════════════════════════════
    // HTTP Routes (called via stub.fetch from Engine Worker)
    // ═════════════════════════════════════════════════════════

    private setupRoutes(): void {
        // POST /init — Initialize room (idempotent)
        this.app.post("/init", async (c) => {
            const body = await c.req.json<{
                roomId?: string;
                ownerId: string;
                ownerDisplayName?: string;
                gameWorkerUrl?: string;
                config?: any;
                context?: any;
            }>();

            // Idempotent: if already initialized for this owner, just return
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
            this.llmWebhookUrl = this.env.LLM_WEBHOOK_URL || null;

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
            console.log(`[GameDO] Initialized. Room: ${this.roomId}, Owner: ${this.ownerId}`);
            return c.json({ success: true });
        });

        // GET /websocket — WebSocket upgrade
        this.app.get("/websocket", async (c) => {
            const upgradeHeader = c.req.header("Upgrade");
            if (!upgradeHeader || upgradeHeader !== "websocket") {
                return c.text("Expected Upgrade: websocket", 426);
            }

            const userId = c.req.query("userId") || "";
            const displayName = c.req.query("displayName") || userId;

            const pair = new WebSocketPair();
            const [client, server] = Object.values(pair);

            await this.handleSession(server, userId, displayName);

            return new Response(null, { status: 101, webSocket: client });
        });

        // GET /debug — Debug info
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
    // WebSocket Session Management
    // ═════════════════════════════════════════════════════════

    private async handleSession(
        ws: WebSocket,
        userId: string,
        displayName: string,
    ): Promise<void> {
        ws.accept();

        const isOwner = userId === this.ownerId;

        // Register or re-register this player
        if (!this.players[userId]) {
            this.players[userId] = {
                displayName,
                connected: true,
                isOwner,
                type: "human",
            };
        } else {
            this.players[userId].connected = true;
            this.players[userId].displayName = displayName;
        }

        // Track connection
        // Close old WS if the same user reconnects
        const oldWs = this.sessions.get(userId);
        if (oldWs) {
            try {
                oldWs.close(1000, "Replaced by new connection");
            } catch (_) { /* ignore */ }
            this.connections.delete(oldWs);
        }

        this.connections.set(ws, userId);
        this.sessions.set(userId, ws);

        await this.persist("players");

        // Send current state to this client
        this.sendSyncState(ws, userId);

        // Broadcast updated lobby to everyone else
        this.broadcastSyncState();

        // Message handler
        ws.addEventListener("message", async (event) => {
            try {
                const data =
                    typeof event.data === "string"
                        ? JSON.parse(event.data)
                        : null;
                if (!data || !data.type) return;
                await this.handleMessage(userId, data as ClientMessage);
            } catch (e) {
                console.error(`[GameDO] Error handling message from ${userId}:`, e);
                this.sendError(ws, "Failed to process message");
            }
        });

        // Close handler
        ws.addEventListener("close", async () => {
            this.connections.delete(ws);
            this.sessions.delete(userId);

            if (this.players[userId]) {
                this.players[userId].connected = false;
                await this.persist("players");
            }

            this.broadcastSyncState();
        });

        ws.addEventListener("error", () => {
            this.connections.delete(ws);
            this.sessions.delete(userId);
            if (this.players[userId]) {
                this.players[userId].connected = false;
            }
        });
    }

    // ═════════════════════════════════════════════════════════
    // Message Router
    // ═════════════════════════════════════════════════════════

    private async handleMessage(userId: string, msg: ClientMessage): Promise<void> {
        switch (msg.type) {
            // ─── Lobby ─────────────────────────────────────
            case "LOBBY_SELECT_ROLE":
                await this.handleSelectRole(userId, msg.payload.roleId);
                break;
            case "LOBBY_LEAVE":
                await this.handleLeave(userId);
                break;

            // ─── Admin ─────────────────────────────────────
            case "ADMIN_SET_GAME":
                await this.handleAdminSetGame(userId, msg.payload);
                break;
            case "ADMIN_ADD_BOT":
                await this.handleAdminAddBot(userId, msg.payload);
                break;
            case "ADMIN_REMOVE_PLAYER":
                await this.handleAdminRemovePlayer(userId, msg.payload.userId);
                break;
            case "ADMIN_ASSIGN_ROLE":
                await this.handleAdminAssignRole(userId, msg.payload);
                break;
            case "ADMIN_START_GAME":
                await this.handleAdminStartGame(userId);
                break;
            case "ADMIN_STOP_GAME":
                await this.handleAdminStopGame(userId);
                break;
            case "ADMIN_RESTART_GAME":
                await this.handleAdminRestartGame(userId);
                break;
            case "ADMIN_PAUSE_GAME":
                await this.handleAdminPauseGame(userId);
                break;
            case "ADMIN_RESUME_GAME":
                await this.handleAdminResumeGame(userId);
                break;

            // ─── Game Action ───────────────────────────────
            case "ACT":
                await this.handleAction(userId, msg.payload);
                break;

            default:
                this.sendErrorToUser(userId, `Unknown message type: ${(msg as any).type}`);
        }
    }

    // ═════════════════════════════════════════════════════════
    // Lobby Handlers
    // ═════════════════════════════════════════════════════════

    private async handleSelectRole(userId: string, roleId: string | null): Promise<void> {
        if (this.phase !== "lobby") {
            return this.sendErrorToUser(userId, "Can only select roles in lobby phase");
        }

        // Remove user from any existing role
        for (const [rId, uId] of Object.entries(this.roleMapping)) {
            if (uId === userId) {
                delete this.roleMapping[rId];
            }
        }

        // Assign new role (if not null)
        if (roleId) {
            // Validate role exists in game config
            if (this.gameConfig && !this.gameConfig.roleIds.includes(roleId)) {
                return this.sendErrorToUser(userId, `Invalid role: ${roleId}`);
            }
            // Check role is not already taken
            if (this.roleMapping[roleId] && this.roleMapping[roleId] !== userId) {
                return this.sendErrorToUser(userId, `Role ${roleId} is already taken`);
            }
            this.roleMapping[roleId] = userId;
        }

        await this.persist("roleMapping");
        this.broadcastSyncState();
    }

    private async handleLeave(userId: string): Promise<void> {
        // Remove from role mapping
        for (const [rId, uId] of Object.entries(this.roleMapping)) {
            if (uId === userId) {
                delete this.roleMapping[rId];
            }
        }

        // Remove from players
        delete this.players[userId];

        // Close WS
        const ws = this.sessions.get(userId);
        if (ws) {
            try {
                ws.close(1000, "Left room");
            } catch (_) { /* ignore */ }
            this.connections.delete(ws);
            this.sessions.delete(userId);
        }

        await this.persist("players", "roleMapping");
        this.broadcastSyncState();
    }

    // ═════════════════════════════════════════════════════════
    // Admin Handlers (owner only)
    // ═════════════════════════════════════════════════════════

    private requireOwner(userId: string): boolean {
        if (userId !== this.ownerId) {
            this.sendErrorToUser(userId, "Only the room owner can perform this action");
            return false;
        }
        return true;
    }

    private async handleAdminSetGame(
        userId: string,
        payload: { gameId: string; gameWorkerUrl: string },
    ): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "lobby") {
            return this.sendErrorToUser(userId, "Can only set game in lobby phase");
        }

        try {
            // Fetch metadata from Game Worker
            const metaRes = await fetch(
                `${payload.gameWorkerUrl.replace(/\/$/, "")}/metadata`,
            );
            if (!metaRes.ok) {
                return this.sendErrorToUser(userId, "Failed to fetch game metadata");
            }
            const metadata = (await metaRes.json()) as GameWorkerMetadata;

            // Resolve roleIds
            let roleIds: string[];
            if (Array.isArray(metadata.roleIds)) {
                roleIds = metadata.roleIds;
            } else {
                // Multi-player-count config — use first available
                const counts = Object.keys(metadata.roleIds).map(Number).sort((a, b) => a - b);
                roleIds = metadata.roleIds[counts[0]] || [];
            }

            this.gameConfig = {
                gameWorkerUrl: payload.gameWorkerUrl,
                gameId: payload.gameId || metadata.id,
                maxPlayers: metadata.maxPlayers || roleIds.length,
                roleIds,
            };

            // Clear role mapping since game changed
            this.roleMapping = {};

            await this.persist("gameConfig", "roleMapping");
            this.broadcastSyncState();
        } catch (e) {
            console.error("[GameDO] Failed to set game:", e);
            this.sendErrorToUser(userId, "Failed to set game");
        }
    }

    private async handleAdminAddBot(
        userId: string,
        payload: {
            displayName: string;
            modelName: string;
            systemPrompt?: string;
            temperature?: number;
        },
    ): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "lobby") {
            return this.sendErrorToUser(userId, "Can only add bots in lobby phase");
        }

        const llmUserId = generateLlmUserId(payload.modelName);
        this.players[llmUserId] = {
            displayName: payload.displayName,
            connected: false, // Bots don't have WS connections
            isOwner: false,
            type: "llm",
            llmConfig: {
                modelName: payload.modelName,
                systemPrompt: payload.systemPrompt || "你是一个聪明的游戏玩家",
                temperature: payload.temperature ?? 0.7,
                memory: "",
            },
        };

        await this.persist("players");
        this.broadcastSyncState();
    }

    private async handleAdminRemovePlayer(
        userId: string,
        targetUserId: string,
    ): Promise<void> {
        if (!this.requireOwner(userId)) return;

        if (targetUserId === this.ownerId) {
            return this.sendErrorToUser(userId, "Cannot remove the room owner");
        }

        if (!this.players[targetUserId]) {
            return this.sendErrorToUser(userId, "Player not found");
        }

        // Remove from role mapping
        for (const [rId, uId] of Object.entries(this.roleMapping)) {
            if (uId === targetUserId) {
                delete this.roleMapping[rId];
            }
        }

        // Remove from players
        delete this.players[targetUserId];

        // Kick if connected
        const targetWs = this.sessions.get(targetUserId);
        if (targetWs) {
            this.sendMessage(targetWs, { type: "KICKED", payload: "Removed by room owner" });
            try {
                targetWs.close(1000, "Kicked");
            } catch (_) { /* ignore */ }
            this.connections.delete(targetWs);
            this.sessions.delete(targetUserId);
        }

        await this.persist("players", "roleMapping");
        this.broadcastSyncState();
    }

    private async handleAdminAssignRole(
        userId: string,
        payload: { roleId: string; userId: string },
    ): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "lobby") {
            return this.sendErrorToUser(userId, "Can only assign roles in lobby phase");
        }

        if (!this.players[payload.userId]) {
            return this.sendErrorToUser(userId, `Player ${payload.userId} not found`);
        }

        if (this.gameConfig && !this.gameConfig.roleIds.includes(payload.roleId)) {
            return this.sendErrorToUser(userId, `Invalid role: ${payload.roleId}`);
        }

        // Remove the target user from any existing role
        for (const [rId, uId] of Object.entries(this.roleMapping)) {
            if (uId === payload.userId) {
                delete this.roleMapping[rId];
            }
        }

        // Remove anyone else from this role
        delete this.roleMapping[payload.roleId];

        // Assign
        this.roleMapping[payload.roleId] = payload.userId;

        await this.persist("roleMapping");
        this.broadcastSyncState();
    }

    private async handleAdminStartGame(userId: string): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "lobby" && this.phase !== "finished") {
            return this.sendErrorToUser(userId, "Game cannot be started in current phase");
        }
        if (!this.gameConfig) {
            return this.sendErrorToUser(userId, "No game selected");
        }

        // Validate all roles assigned
        const missingRoles = this.gameConfig.roleIds.filter(
            (rId) => !this.roleMapping[rId],
        );
        if (missingRoles.length > 0) {
            return this.sendErrorToUser(
                userId,
                `Missing role assignments: ${missingRoles.join(", ")}`,
            );
        }

        try {
            // Clear LLM memory
            for (const player of Object.values(this.players)) {
                if (player.type === "llm" && player.llmConfig) {
                    player.llmConfig.memory = "";
                }
            }

            // Initialize game state via Game Worker
            const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const initRes = await fetch(`${baseUrl}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    players: Object.keys(this.roleMapping),
                }),
            });

            if (!initRes.ok) {
                const errText = await initRes.text();
                return this.sendErrorToUser(
                    userId,
                    `Game Worker init failed: ${errText}`,
                );
            }

            this.gameState = await initRes.json();
            this.history = [];
            this.phase = "playing";

            await this.persistAll();
            this.broadcastSyncState();

            // Check if first turn is LLM
            this.ctx.waitUntil(this.checkAndTriggerNextTurn());
        } catch (e) {
            console.error("[GameDO] Failed to start game:", e);
            this.sendErrorToUser(userId, "Failed to start game");
        }
    }

    private async handleAdminStopGame(userId: string): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase === "lobby") {
            return this.sendErrorToUser(userId, "Game has not started");
        }

        this.phase = "lobby";
        this.gameState = null;
        this.history = [];
        // Keep gameConfig, players, roleMapping

        await this.persist("phase", "gameState", "history");
        this.broadcastSyncState();
    }

    private async handleAdminRestartGame(userId: string): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "playing" && this.phase !== "finished") {
            return this.sendErrorToUser(userId, "Nothing to restart");
        }
        if (!this.gameConfig) {
            return this.sendErrorToUser(userId, "No game selected");
        }

        try {
            // Clear LLM memory
            for (const player of Object.values(this.players)) {
                if (player.type === "llm" && player.llmConfig) {
                    player.llmConfig.memory = "";
                }
            }

            // Re-initialize game state
            const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const initRes = await fetch(`${baseUrl}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    players: Object.keys(this.roleMapping),
                }),
            });

            if (!initRes.ok) {
                return this.sendErrorToUser(userId, "Game Worker init failed on restart");
            }

            this.gameState = await initRes.json();
            this.history = [];
            this.phase = "playing";

            await this.persistAll();
            this.broadcastSyncState();

            this.ctx.waitUntil(this.checkAndTriggerNextTurn());
        } catch (e) {
            console.error("[GameDO] Failed to restart game:", e);
            this.sendErrorToUser(userId, "Failed to restart game");
        }
    }

    private async handleAdminPauseGame(userId: string): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "playing") {
            return this.sendErrorToUser(userId, "Game is not playing");
        }
        // We model pause as "finished" for simplicity (no actions allowed)
        // The owner can resume by restarting or we can add a "paused" phase
        this.phase = "finished";
        await this.persist("phase");
        this.broadcastSyncState();
    }

    private async handleAdminResumeGame(userId: string): Promise<void> {
        if (!this.requireOwner(userId)) return;
        if (this.phase !== "finished") {
            return this.sendErrorToUser(userId, "Game is not paused/finished");
        }
        if (!this.gameState) {
            return this.sendErrorToUser(userId, "No game state to resume");
        }
        this.phase = "playing";
        await this.persist("phase");
        this.broadcastSyncState();

        this.ctx.waitUntil(this.checkAndTriggerNextTurn());
    }

    // ═════════════════════════════════════════════════════════
    // Game Action Handler
    // ═════════════════════════════════════════════════════════

    private async handleAction(
        userId: string,
        payload: { actionId: string; params?: Record<string, any> },
    ): Promise<void> {
        if (this.phase !== "playing") {
            return this.sendErrorToUser(userId, "Game is not in playing phase");
        }
        if (!this.gameConfig || !this.gameState) {
            return this.sendErrorToUser(userId, "Game not initialized");
        }

        // Find role for this user
        const roleId = getRoleForUser(this.roleMapping, userId);
        if (!roleId) {
            return this.sendErrorToUser(userId, "You don't have a role assigned");
        }

        // Verify it's this player's turn
        const currentRoleId = await this.getCurrentRole();
        if (currentRoleId !== roleId) {
            return this.sendErrorToUser(userId, "Not your turn");
        }

        // Submit to Game Worker
        const result = await this.submitActionToGameWorker(roleId, {
            actionId: payload.actionId,
            params: payload.params || {},
        });

        if (!result.success) {
            return this.sendErrorToUser(userId, result.error || "Action rejected");
        }

        // Update state
        this.gameState = result.nextState;
        this.history.push({
            turn: this.history.length + 1,
            roleId,
            action: { actionId: payload.actionId, params: payload.params || {} },
            timestamp: Date.now(),
        });

        // Check terminal
        const terminal = await this.isTerminal();
        if (terminal) {
            this.phase = "finished";
        }

        await this.persist("gameState", "history", "phase");
        this.broadcastSyncState();

        // Check next turn for LLM
        if (!terminal) {
            this.ctx.waitUntil(this.checkAndTriggerNextTurn());
        }
    }

    // ═════════════════════════════════════════════════════════
    // Game Worker RPC
    // ═════════════════════════════════════════════════════════

    private getGameWorkerBaseUrl(): string {
        return this.gameConfig!.gameWorkerUrl.replace(/\/$/, "");
    }

    private async getCurrentRole(): Promise<string | null> {
        if (!this.gameState || !this.gameConfig) return null;
        try {
            const res = await fetch(`${this.getGameWorkerBaseUrl()}/current-role`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: this.gameState }),
            });
            if (!res.ok) return null;
            const data = await res.json() as any;
            return data.roleId || data.role_id || data;
        } catch (e) {
            console.error("[GameDO] getCurrentRole failed:", e);
            return null;
        }
    }

    private async isTerminal(): Promise<boolean> {
        if (!this.gameState || !this.gameConfig) return false;
        try {
            const res = await fetch(`${this.getGameWorkerBaseUrl()}/is-terminal`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ state: this.gameState }),
            });
            if (!res.ok) return false;
            const data = await res.json() as any;
            return data === true || data.terminal === true || data.isTerminal === true;
        } catch (e) {
            console.error("[GameDO] isTerminal failed:", e);
            return false;
        }
    }

    private async submitActionToGameWorker(
        roleId: string,
        action: { actionId: string; params: Record<string, any> },
    ): Promise<{ success: boolean; nextState?: any; error?: string }> {
        try {
            const body: GameWorkerActionRequest = {
                state: this.gameState,
                action: {
                    action_id: action.actionId,
                    params: action.params,
                    role_id: roleId,
                },
            };

            const res = await fetch(`${this.getGameWorkerBaseUrl()}/action`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = (await res.json()) as GameWorkerActionResponse;
            return {
                success: data.success,
                nextState: data.nextState,
                error: data.error,
            };
        } catch (e) {
            console.error("[GameDO] submitAction failed:", e);
            return { success: false, error: "Game Worker unreachable" };
        }
    }

    private async fetchPerspective(roleId: string): Promise<any | null> {
        if (!this.gameState || !this.gameConfig) return null;
        try {
            const diffHistory = this.calculateDiffHistory(roleId);
            const body: GameWorkerPerspectiveRequest = {
                state: this.gameState,
                roleId,
                wholeHistory: this.history,
                diffHistory,
            };

            const res = await fetch(`${this.getGameWorkerBaseUrl()}/perspective`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.error("[GameDO] fetchPerspective failed:", e);
            return null;
        }
    }

    private calculateDiffHistory(roleId: string): HistoryEvent[] {
        const lastIndex = this.history.findLastIndex((e) => e.roleId === roleId);
        if (lastIndex === -1) return [...this.history];
        return this.history.slice(lastIndex);
    }

    // ═════════════════════════════════════════════════════════
    // LLM Webhook Integration
    // ═════════════════════════════════════════════════════════

    private async checkAndTriggerNextTurn(): Promise<void> {
        if (this.phase !== "playing" || !this.gameState) return;

        const currentRoleId = await this.getCurrentRole();
        if (!currentRoleId) return;

        const userId = this.roleMapping[currentRoleId];
        if (!userId) return;

        if (isLlmUserId(userId)) {
            await this.callLlmWebhook(currentRoleId);
        }
    }

    private async callLlmWebhook(roleId: string): Promise<void> {
        const userId = this.roleMapping[roleId];
        const player = this.players[userId];
        if (!player?.llmConfig || !this.llmWebhookUrl || !this.gameConfig) return;

        const maxAttempts = 3;
        let previousError: string | undefined;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // 1. Get perspective
                const perspective = await this.fetchPerspective(roleId);
                if (!perspective) {
                    previousError = "Failed to generate perspective";
                    await this.sleep(Math.pow(2, attempt - 1) * 500);
                    continue;
                }

                // 2. Call Backend LLM webhook
                const webhookBody: LlmWebhookRequest = {
                    roomId: this.roomId,
                    roleId,
                    gameId: this.gameConfig.gameId,
                    perspective,
                    llmConfig: player.llmConfig,
                    attempt,
                    maxAttempts,
                    previousError,
                };

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                };
                if (this.env.LLM_WEBHOOK_SECRET) {
                    headers["X-Engine-Secret"] = this.env.LLM_WEBHOOK_SECRET;
                }

                const resp = await fetch(this.llmWebhookUrl, {
                    method: "POST",
                    headers,
                    body: JSON.stringify(webhookBody),
                });

                if (!resp.ok) {
                    previousError = `Webhook HTTP ${resp.status}: ${await resp.text()}`;
                    console.error(`[GameDO] LLM webhook failed (attempt ${attempt}):`, previousError);
                    await this.sleep(Math.pow(2, attempt - 1) * 500);
                    continue;
                }

                const result = (await resp.json()) as LlmWebhookResponse;

                // 3. Submit action to Game Worker
                const actResult = await this.submitActionToGameWorker(roleId, {
                    actionId: result.action.actionId,
                    params: result.action.params,
                });

                if (!actResult.success) {
                    previousError = actResult.error || "Action rejected by game";
                    console.warn(
                        `[GameDO] LLM action rejected (attempt ${attempt}):`,
                        previousError,
                    );
                    await this.sleep(Math.pow(2, attempt - 1) * 500);
                    continue;
                }

                // 4. Update state
                this.gameState = actResult.nextState;
                this.history.push({
                    turn: this.history.length + 1,
                    roleId,
                    action: {
                        actionId: result.action.actionId,
                        params: result.action.params,
                    },
                    timestamp: Date.now(),
                });

                // 5. Update LLM memory
                if (result.memoryUpdate && player.llmConfig) {
                    player.llmConfig.memory = this.applyMemoryUpdate(
                        player.llmConfig.memory,
                        result.memoryUpdate,
                    );
                }

                // 6. Check terminal
                const terminal = await this.isTerminal();
                if (terminal) {
                    this.phase = "finished";
                }

                await this.persistAll();
                this.broadcastSyncState();

                console.log(
                    `[GameDO] LLM turn complete. Role: ${roleId}, Action: ${result.action.actionId}`,
                );

                // 7. Check next turn (delay to avoid tight loop)
                if (!terminal) {
                    await this.sleep(200);
                    await this.checkAndTriggerNextTurn();
                }
                return;
            } catch (e) {
                console.error(`[GameDO] LLM webhook error (attempt ${attempt}):`, e);
                previousError = `Exception: ${e}`;
                await this.sleep(Math.pow(2, attempt - 1) * 500);
            }
        }

        console.error(
            `[GameDO] LLM webhook exhausted all ${maxAttempts} attempts for role ${roleId}`,
        );
    }

    private applyMemoryUpdate(
        currentMemory: string,
        update: { mode: "append" | "replace"; content: string },
    ): string {
        if (update.mode === "replace") return update.content;
        return currentMemory
            ? `${currentMemory}\n${update.content}`
            : update.content;
    }

    // ═════════════════════════════════════════════════════════
    // Broadcasting — SYNC_STATE
    // ═════════════════════════════════════════════════════════

    private broadcastSyncState(): void {
        for (const [ws, userId] of this.connections.entries()) {
            this.sendSyncState(ws, userId);
        }
    }

    private async sendSyncState(ws: WebSocket, userId: string): Promise<void> {
        const engineState = this.generateClientState(userId);

        // Get game perspective for this user's role
        let gamePerspective: any | null = null;
        if (this.phase === "playing" || this.phase === "finished") {
            const roleId = getRoleForUser(this.roleMapping, userId) || "spectator";
            gamePerspective = await this.fetchPerspective(roleId);
        }

        const msg: ServerMessage = {
            type: "SYNC_STATE",
            payload: {
                engine: engineState,
                game: gamePerspective,
            },
        };

        this.sendMessage(ws, msg);
    }

    private generateClientState(userId: string): ClientEngineState {
        const clientPlayers: Record<string, ClientPlayerInfo> = {};
        for (const [uid, p] of Object.entries(this.players)) {
            clientPlayers[uid] = {
                displayName: p.displayName,
                connected: p.connected,
                isOwner: p.isOwner,
                type: p.type,
                role: getRoleForUser(this.roleMapping, uid),
            };
        }

        return {
            roomId: this.roomId,
            ownerId: this.ownerId,
            ownerDisplayName: this.ownerDisplayName,
            phase: this.phase,
            players: clientPlayers,
            gameConfig: this.gameConfig
                ? {
                    gameId: this.gameConfig.gameId,
                    maxPlayers: this.gameConfig.maxPlayers,
                    roleIds: this.gameConfig.roleIds,
                }
                : null,
            you: {
                userId,
                isOwner: userId === this.ownerId,
                role: getRoleForUser(this.roleMapping, userId),
            },
        };
    }

    // ═════════════════════════════════════════════════════════
    // WebSocket Utilities
    // ═════════════════════════════════════════════════════════

    private sendMessage(ws: WebSocket, msg: ServerMessage): void {
        try {
            ws.send(JSON.stringify(msg));
        } catch (e) {
            console.error("[GameDO] Failed to send message:", e);
        }
    }

    private sendError(ws: WebSocket, message: string): void {
        this.sendMessage(ws, { type: "ERROR", payload: message });
    }

    private sendErrorToUser(userId: string, message: string): void {
        const ws = this.sessions.get(userId);
        if (ws) {
            this.sendError(ws, message);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
