import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { GameConfig, GameState, Player, LobbyState, RoomPhase } from "./types";

/**
 * GameDO — The Room Container (Durable Object).
 *
 * Manages the full lifecycle of a room:
 *   LOBBY (waiting for players / role assignment) -> PLAYING (game active) -> FINISHED
 *
 * Ownership is determined by comparing the connecting user's `sub` (from JWT)
 * with the `ownerId` stored in this DO's persistent storage.
 */
export class GameDO extends DurableObject {
    doState: DurableObjectState;
    app: Hono = new Hono();

    // --- Persistent state (loaded from storage) ---
    ownerId: string | null = null;
    phase: RoomPhase = 'lobby';
    lobbyPlayers: Record<string, { displayName: string; role: string | null }> = {};
    roleMapping: Record<string, string> = {};  // roleId -> userId
    gameConfig: GameConfig | null = null;

    // --- Game state (only active during 'playing' phase) ---
    gameState: GameState | null = null;
    history: any[] = [];

    // --- In-memory connection tracking ---
    connections: Map<WebSocket, Player> = new Map();
    sessions: Map<string, WebSocket> = new Map(); // userId -> ws

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        this.doState = state;

        // Load persisted state
        this.doState.blockConcurrencyWhile(async () => {
            this.ownerId = (await this.doState.storage.get("ownerId")) || null;
            this.phase = (await this.doState.storage.get("phase")) || 'lobby';
            this.lobbyPlayers = (await this.doState.storage.get("lobbyPlayers")) || {};
            this.roleMapping = (await this.doState.storage.get("roleMapping")) || {};
            this.gameConfig = (await this.doState.storage.get("gameConfig")) || null;
            this.gameState = (await this.doState.storage.get("gameState")) || null;
            this.history = (await this.doState.storage.get("history")) || [];
        });

        // ==========================================
        // Internal HTTP routes (called via stub.fetch)
        // ==========================================

        /**
         * POST /init — Initialize room (idempotent).
         * Called by the Engine Worker on behalf of the Backend.
         * If the DO is already initialized with the same owner, this is a no-op.
         */
        this.app.post("/init", async (c) => {
            const body = await c.req.json<{
                ownerId: string;
                gameWorkerUrl?: string;
                config?: any;
                context?: any;
            }>();

            // Idempotent: if already initialized for this owner, just return success
            if (this.ownerId === body.ownerId) {
                console.log(`[GameDO] Already initialized for owner ${this.ownerId}, phase=${this.phase}`);
                return c.json({ success: true, alreadyInitialized: true, phase: this.phase });
            }

            this.ownerId = body.ownerId;
            this.phase = 'lobby';
            this.lobbyPlayers = {};
            this.roleMapping = {};
            this.gameState = null;
            this.history = [];

            if (body.gameWorkerUrl) {
                this.gameConfig = {
                    gameWorkerUrl: body.gameWorkerUrl,
                    maxPlayers: body.config?.maxPlayers || 2,
                    ...body.config,
                };
            } else {
                this.gameConfig = null;
            }

            await this.persistAll();

            console.log(`[GameDO] Initialized. Owner: ${this.ownerId}`);
            return c.json({ success: true });
        });

        /**
         * GET /websocket — WebSocket upgrade handler.
         * userId and displayName are passed via query params (already verified by Engine Worker).
         */
        this.app.get("/websocket", async (c) => {
            const upgradeHeader = c.req.header("Upgrade");
            if (!upgradeHeader || upgradeHeader !== "websocket") {
                return c.text("Expected Upgrade: websocket", 426);
            }

            const userId = c.req.query("userId")!;
            const displayName = c.req.query("displayName") || userId;

            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);

            this.handleSession(server, userId, displayName);

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        });

        /**
         * GET /debug — Debug state dump
         */
        this.app.get("/debug", (c) => {
            return c.json({
                ownerId: this.ownerId,
                phase: this.phase,
                lobbyPlayers: this.lobbyPlayers,
                roleMapping: this.roleMapping,
                hasGameConfig: !!this.gameConfig,
                hasGameState: !!this.gameState,
                gameState: this.gameState,
                historyLength: this.history.length,
                connectedUsers: Array.from(this.connections.values()).map(p => ({
                    userId: p.userId,
                    displayName: p.displayName,
                    role: p.role,
                    isOwner: p.isOwner,
                    connected: p.connected
                }))
            });
        });
    }

    async fetch(request: Request): Promise<Response> {
        return this.app.fetch(request);
    }

    // ==========================================
    // WebSocket Session Management
    // ==========================================

    async handleSession(ws: WebSocket, userId: string, displayName: string) {
        ws.accept();

        const isOwner = userId === this.ownerId;
        const existingRole = this.lobbyPlayers[userId]?.role || null;

        const player: Player = {
            userId,
            displayName,
            role: existingRole,
            connected: true,
            isOwner,
            ws,
        };

        // Track connection
        this.connections.set(ws, player);
        this.sessions.set(userId, ws);

        // Auto-join lobby if not already present
        if (!this.lobbyPlayers[userId]) {
            this.lobbyPlayers[userId] = { displayName, role: null };
            await this.doState.storage.put("lobbyPlayers", this.lobbyPlayers);
        }

        // Send current state to the newly connected client
        this.sendFullState(ws, player);

        // Broadcast updated lobby to everyone
        this.broadcastLobbyUpdate();

        // Message handler
        ws.addEventListener("message", async (msg) => {
            try {
                const data = JSON.parse(msg.data as string);
                await this.handleMessage(player, data);
            } catch (e) {
                console.error("[GameDO] Error handling message:", e);
                ws.send(JSON.stringify({ type: "ERROR", payload: "Invalid message" }));
            }
        });

        // Disconnect handler
        ws.addEventListener("close", () => {
            this.connections.delete(ws);
            this.sessions.delete(userId);
            // Don't remove from lobbyPlayers on disconnect (they can reconnect)
            this.broadcastLobbyUpdate();
        });
    }

    // ==========================================
    // Message Router
    // ==========================================

    async handleMessage(player: Player, data: { type: string; payload?: any }) {
        switch (data.type) {
            // --- Lobby messages ---
            case 'LOBBY_LEAVE':
                await this.handleLobbyLeave(player);
                break;
            case 'LOBBY_SELECT_ROLE':
                await this.handleSelectRole(player, data.payload);
                break;
            case 'LOBBY_KICK_PLAYER':
                await this.handleKickPlayer(player, data.payload);
                break;
            case 'LOBBY_SET_GAME':
                await this.handleSetGame(player, data.payload);
                break;
            case 'GAME_START':
                await this.handleGameStart(player, data.payload);
                break;
            case 'GAME_STOP':
                await this.handleGameStop(player);
                break;
            case 'GAME_RESTART':
                await this.handleGameRestart(player);
                break;

            // --- Game messages ---
            case 'ACT':
                await this.handleAction(player, data.payload);
                break;

            default:
                player.ws?.send(JSON.stringify({
                    type: "ERROR",
                    payload: `Unknown message type: ${data.type}`
                }));
        }
    }

    // ==========================================
    // Lobby Handlers
    // ==========================================

    async handleLobbyLeave(player: Player) {
        // Remove from lobby
        delete this.lobbyPlayers[player.userId];

        // Remove from role mapping
        for (const [roleId, userId] of Object.entries(this.roleMapping)) {
            if (userId === player.userId) {
                delete this.roleMapping[roleId];
            }
        }

        await this.doState.storage.put("lobbyPlayers", this.lobbyPlayers);
        await this.doState.storage.put("roleMapping", this.roleMapping);

        this.broadcastLobbyUpdate();

        // Close their connection
        player.ws?.close(1000, "Left room");
    }

    async handleSelectRole(player: Player, payload: { roleId: string | null }) {
        if (this.phase !== 'lobby') {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Cannot change roles during game" }));
            return;
        }

        const { roleId } = payload;

        // If roleId is null, unassign current role
        if (roleId === null) {
            for (const [rid, uid] of Object.entries(this.roleMapping)) {
                if (uid === player.userId) {
                    delete this.roleMapping[rid];
                }
            }
        } else {
            // Check if role is already taken by someone else
            if (this.roleMapping[roleId] && this.roleMapping[roleId] !== player.userId) {
                player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Role already taken" }));
                return;
            }

            // Remove player from any previous role
            for (const [rid, uid] of Object.entries(this.roleMapping)) {
                if (uid === player.userId) {
                    delete this.roleMapping[rid];
                }
            }

            // Assign new role
            this.roleMapping[roleId] = player.userId;
        }

        // Update lobby player's role
        if (this.lobbyPlayers[player.userId]) {
            this.lobbyPlayers[player.userId].role = roleId;
        }
        player.role = roleId;

        await this.doState.storage.put("roleMapping", this.roleMapping);
        await this.doState.storage.put("lobbyPlayers", this.lobbyPlayers);

        this.broadcastLobbyUpdate();
    }

    async handleKickPlayer(player: Player, payload: { userId: string }) {
        if (!player.isOwner) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Only owner can kick players" }));
            return;
        }

        const targetUserId = payload.userId;
        if (targetUserId === this.ownerId) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Cannot kick owner" }));
            return;
        }

        // Remove from lobby
        delete this.lobbyPlayers[targetUserId];

        // Remove from role mapping
        for (const [roleId, userId] of Object.entries(this.roleMapping)) {
            if (userId === targetUserId) {
                delete this.roleMapping[roleId];
            }
        }

        await this.doState.storage.put("lobbyPlayers", this.lobbyPlayers);
        await this.doState.storage.put("roleMapping", this.roleMapping);

        // Close target's WebSocket
        const targetWs = this.sessions.get(targetUserId);
        if (targetWs) {
            targetWs.send(JSON.stringify({ type: "KICKED", payload: "You were removed by the owner" }));
            targetWs.close(1000, "Kicked by owner");
        }

        this.broadcastLobbyUpdate();
    }

    async handleSetGame(player: Player, payload: { gameWorkerUrl: string; config?: any }) {
        if (!player.isOwner) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Only owner can set game" }));
            return;
        }

        if (this.phase !== 'lobby') {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Cannot change game during play" }));
            return;
        }

        this.gameConfig = {
            gameWorkerUrl: payload.gameWorkerUrl,
            maxPlayers: payload.config?.maxPlayers || 2,
            ...payload.config,
        };

        await this.doState.storage.put("gameConfig", this.gameConfig);
        this.broadcastLobbyUpdate();
    }

    // ==========================================
    // Game Lifecycle Handlers
    // ==========================================

    async handleGameStart(player: Player, payload?: {
        gameWorkerUrl?: string;
        roleMapping?: Record<string, string>;
    }) {
        if (!player.isOwner) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Only owner can start game" }));
            return;
        }

        if (this.phase !== 'lobby') {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Game already started" }));
            return;
        }

        // Accept gameWorkerUrl from payload (frontend sends it)
        if (payload?.gameWorkerUrl) {
            this.gameConfig = {
                maxPlayers: 2,
                ...(this.gameConfig || {}),
                gameWorkerUrl: payload.gameWorkerUrl,
            };
            await this.doState.storage.put("gameConfig", this.gameConfig);
        }

        // Accept roleMapping from payload (frontend sends it)
        if (payload?.roleMapping) {
            this.roleMapping = payload.roleMapping;
            await this.doState.storage.put("roleMapping", this.roleMapping);

            // Sync roles to connected Player objects
            // roleMapping is { roleId: userId }, reverse to find each player's role
            const userIdToRole = new Map<string, string>();
            for (const [roleId, userId] of Object.entries(this.roleMapping)) {
                userIdToRole.set(userId, roleId);
            }
            for (const p of this.connections.values()) {
                const role = userIdToRole.get(p.userId) || null;
                p.role = role;
                // Also update lobbyPlayers
                if (this.lobbyPlayers[p.userId]) {
                    this.lobbyPlayers[p.userId].role = role;
                }
            }
            await this.doState.storage.put("lobbyPlayers", this.lobbyPlayers);
        }

        if (!this.gameConfig?.gameWorkerUrl) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "No game configured. Send gameWorkerUrl." }));
            return;
        }

        // Call Game Worker /init
        try {
            const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const players = Object.keys(this.roleMapping);

            if (players.length === 0) {
                player.ws?.send(JSON.stringify({ type: "ERROR", payload: "No roles assigned" }));
                return;
            }

            const initRes = await fetch(`${baseUrl}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ players, ...this.gameConfig }),
            });

            if (!initRes.ok) {
                throw new Error(`Game Worker init failed: ${initRes.status}`);
            }

            this.gameState = await initRes.json();
            this.history = [];
            this.phase = 'playing';

            await this.doState.storage.put("gameState", this.gameState);
            await this.doState.storage.put("history", this.history);
            await this.doState.storage.put("phase", this.phase);

            // Broadcast game started + lobby update with new phase + initial perspectives
            this.broadcastToAll({ type: "GAME_STARTED", payload: { roleMapping: this.roleMapping } });
            this.broadcastLobbyUpdate();
            await this.broadcastGameState();

        } catch (e: any) {
            console.error("[GameDO] Game start failed:", e);
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: `Failed to start game: ${e.message}` }));
        }
    }

    async handleGameStop(player: Player) {
        if (!player.isOwner) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Only owner can stop game" }));
            return;
        }

        this.phase = 'lobby';
        this.gameState = null;
        this.history = [];

        await this.doState.storage.put("phase", this.phase);
        await this.doState.storage.delete("gameState");
        await this.doState.storage.put("history", []);

        this.broadcastToAll({ type: "GAME_STOPPED", payload: {} });
        this.broadcastLobbyUpdate();
    }

    async handleGameRestart(player: Player) {
        if (!player.isOwner) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Only owner can restart game" }));
            return;
        }

        if (!this.gameConfig?.gameWorkerUrl) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "No game configured" }));
            return;
        }

        // Re-init game
        try {
            const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const players = Object.keys(this.roleMapping);

            const initRes = await fetch(`${baseUrl}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ players, ...this.gameConfig }),
            });

            if (!initRes.ok) throw new Error("Game Worker init failed");
            this.gameState = await initRes.json();
            this.history = [];
            this.phase = 'playing';

            await this.doState.storage.put("gameState", this.gameState);
            await this.doState.storage.put("history", this.history);
            await this.doState.storage.put("phase", this.phase);

            this.broadcastToAll({ type: "GAME_RESTARTED", payload: { roleMapping: this.roleMapping } });
            await this.broadcastGameState();

        } catch (e: any) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: `Failed to restart: ${e.message}` }));
        }
    }

    // ==========================================
    // Game Action Handler
    // ==========================================

    async handleAction(player: Player, actionPayload: any) {
        if (this.phase !== 'playing') {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Game not in progress" }));
            return;
        }

        if (!this.gameConfig || !this.gameState) return;

        try {
            const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");

            const res = await fetch(`${baseUrl}/act`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: this.gameState,
                    action: actionPayload,
                    roleId: player.role,
                }),
            });

            if (!res.ok) {
                const err = await res.json() as any;
                player.ws?.send(JSON.stringify({ type: "ERROR", payload: err.error || err.message || "Action failed" }));
                return;
            }

            const result = await res.json() as any;
            if (!result.success) {
                player.ws?.send(JSON.stringify({ type: "ERROR", payload: result.error }));
                return;
            }

            // Update state
            const previousState = this.gameState;
            this.gameState = result.nextState;

            // Record history
            this.history.push({
                turn: (previousState as any).turn || 0,
                role_id: player.role,
                action: actionPayload,
                timestamp: new Date().toISOString(),
                description: `${player.displayName} (${player.role}) performed ${actionPayload.action_id}`
            });

            await this.doState.storage.put("gameState", this.gameState);
            await this.doState.storage.put("history", this.history);

            // Broadcast updated perspectives
            await this.broadcastGameState();

        } catch (e: any) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Game Worker Error: " + e.message }));
        }
    }

    // ==========================================
    // Broadcasting
    // ==========================================

    /**
     * Send a message to all connected WebSockets
     */
    broadcastToAll(message: any) {
        const msg = JSON.stringify(message);
        for (const player of this.connections.values()) {
            try {
                player.ws?.send(msg);
            } catch (e) {
                // Ignore send errors on stale connections
            }
        }
    }

    /**
     * Send full current state to a single client
     */
    sendFullState(ws: WebSocket, player: Player) {
        if (this.phase === 'lobby') {
            ws.send(JSON.stringify({
                type: "LOBBY_STATE",
                payload: this.buildLobbyPayload(player),
            }));
        } else if (this.phase === 'playing' || this.phase === 'finished') {
            // Send lobby info + game state
            ws.send(JSON.stringify({
                type: "LOBBY_STATE",
                payload: this.buildLobbyPayload(player),
            }));
            // Game perspective will be sent after
            this.sendGamePerspective(ws, player);
        }
    }

    /**
     * Build lobby state payload
     */
    buildLobbyPayload(forPlayer: Player) {
        // Build connected status map
        const connectedUsers = new Set<string>();
        for (const p of this.connections.values()) {
            connectedUsers.add(p.userId);
        }

        const players: Record<string, any> = {};
        for (const [userId, info] of Object.entries(this.lobbyPlayers)) {
            players[userId] = {
                ...info,
                connected: connectedUsers.has(userId),
                isOwner: userId === this.ownerId,
            };
        }

        return {
            ownerId: this.ownerId,
            phase: this.phase,
            players,
            roleMapping: this.roleMapping,
            hasGameConfig: !!this.gameConfig,
            you: {
                userId: forPlayer.userId,
                isOwner: forPlayer.isOwner,
                role: forPlayer.role,
            },
        };
    }

    /**
     * Broadcast lobby update to all connected clients
     */
    broadcastLobbyUpdate() {
        for (const [ws, player] of this.connections) {
            try {
                ws.send(JSON.stringify({
                    type: "LOBBY_UPDATE",
                    payload: this.buildLobbyPayload(player),
                }));
            } catch (e) {
                // Ignore
            }
        }
    }

    /**
     * Broadcast game perspectives to all connected players
     */
    async broadcastGameState() {
        if (!this.gameConfig || !this.gameState) return;

        // Group by role to minimize Game Worker calls
        const roleGroups = new Map<string, WebSocket[]>();
        for (const player of this.connections.values()) {
            if (!player.ws) continue;
            const role = player.role || 'spectator';
            if (!roleGroups.has(role)) {
                roleGroups.set(role, []);
            }
            roleGroups.get(role)!.push(player.ws);
        }

        const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");

        for (const [roleId, sockets] of roleGroups.entries()) {
            try {
                const res = await fetch(`${baseUrl}/perspective`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        state: this.gameState,
                        roleId,
                        wholeHistory: this.history,
                        diffHistory: [],
                    }),
                });

                if (!res.ok) {
                    console.error(`[GameDO] Perspective fetch failed for ${roleId}`);
                    continue;
                }

                const perspective = await res.json();
                const msg = JSON.stringify({
                    type: "STATE_UPDATE",
                    payload: perspective,
                });

                for (const ws of sockets) {
                    ws.send(msg);
                }
            } catch (e) {
                console.error(`[GameDO] Error broadcasting to ${roleId}:`, e);
            }
        }
    }

    /**
     * Send game perspective to a single client
     */
    async sendGamePerspective(ws: WebSocket, player: Player) {
        if (!this.gameState || !this.gameConfig) return;

        try {
            const baseUrl = this.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const res = await fetch(`${baseUrl}/perspective`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: this.gameState,
                    roleId: player.role || 'spectator',
                    wholeHistory: this.history,
                    diffHistory: [],
                }),
            });

            if (res.ok) {
                const perspective = await res.json();
                ws.send(JSON.stringify({
                    type: "STATE_UPDATE",
                    payload: perspective,
                }));
            }
        } catch (e) {
            console.error("[GameDO] Failed to send perspective:", e);
        }
    }

    // ==========================================
    // Persistence
    // ==========================================

    async persistAll() {
        await this.doState.storage.put("ownerId", this.ownerId);
        await this.doState.storage.put("phase", this.phase);
        await this.doState.storage.put("lobbyPlayers", this.lobbyPlayers);
        await this.doState.storage.put("roleMapping", this.roleMapping);
        await this.doState.storage.put("gameConfig", this.gameConfig);
        await this.doState.storage.put("gameState", this.gameState);
        await this.doState.storage.put("history", this.history);
    }
}
