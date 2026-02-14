import { DurableObject } from "cloudflare:workers";
import { Hono } from "hono";
import { GameConfig, GameState, Player, TokenPayload } from "./types";

export class GameDO extends DurableObject {
    state: DurableObjectState;
    app: Hono = new Hono();

    // In-memory state
    config: GameConfig | null = null;
    gameState: GameState | null = null;
    history: any[] = []; // Store history events
    players: Map<WebSocket, Player> = new Map();
    sessions: Map<string, WebSocket> = new Map(); // userId -> ws

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        this.state = state;

        // Load state from storage
        this.state.blockConcurrencyWhile(async () => {
            this.config = (await this.state.storage.get("config")) || null;
            this.gameState = (await this.state.storage.get("gameState")) || null;
            this.history = (await this.state.storage.get("history")) || [];
        });

        // --- Routes inside DO ---

        // 1. Initialize Game (called by Worker via RPC)
        this.app.post("/init", async (c) => {
            const body = await c.req.json<{ config: GameConfig; context: any }>();
            this.config = body.config;

            // Call Game Worker to get initial state
            try {
                const initRes = await fetch(`${this.config.gameWorkerUrl}/init`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body.config),
                });

                if (!initRes.ok) throw new Error("Failed to init game");
                this.gameState = await initRes.json();
                this.history = []; // Reset history

                // Persist
                await this.state.storage.put("config", this.config);
                await this.state.storage.put("gameState", this.gameState);
                await this.state.storage.put("history", this.history);

                return c.json({ success: true, state: this.gameState });
            } catch (e: any) {
                return c.json({ error: e.message }, 500);
            }
        });

        // 2. Handle WebSocket Upgrade
        this.app.get("/websocket", async (c) => {
            const upgradeHeader = c.req.header("Upgrade");
            if (!upgradeHeader || upgradeHeader !== "websocket") {
                return c.text("Expected Upgrade: websocket", 426);
            }

            // Extract user info passed from Worker (verified token)
            const userId = c.req.query("userId")!;
            const role = c.req.query("role")!;

            const webSocketPair = new WebSocketPair();
            const [client, server] = Object.values(webSocketPair);

            this.handleSession(server, userId, role);

            return new Response(null, {
                status: 101,
                webSocket: client,
            });
        });
    }

    // Handle Fetch requests from Worker
    async fetch(request: Request): Promise<Response> {
        return this.app.fetch(request);
    }

    // WebSocket Session Handler
    async handleSession(ws: WebSocket, userId: string, role: string) {
        ws.accept();

        const player: Player = { userId, role, connected: true, ws };
        this.players.set(ws, player);
        this.sessions.set(userId, ws);

        // Send initial state/perspective
        await this.sendPerspective(ws, player);

        ws.addEventListener("message", async (msg) => {
            try {
                const data = JSON.parse(msg.data as string);
                if (data.type === "ACT") {
                    await this.handleAction(player, data.payload);
                }
            } catch (e) {
                console.error("Error handling message", e);
            }
        });

        ws.addEventListener("close", () => {
            this.players.delete(ws);
            this.sessions.delete(userId);
        });
    }

    // Core Action Loop
    async handleAction(player: Player, actionPayload: any) {
        if (!this.config || !this.gameState) return;

        try {
            // 1. Call Game Worker
            const res = await fetch(`${this.config.gameWorkerUrl}/act`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: this.gameState,
                    action: actionPayload,
                    roleId: player.role // Add role for validation check inside worker
                }),
            });

            if (!res.ok) {
                const err = await res.json() as any;
                player.ws?.send(JSON.stringify({ type: "ERROR", payload: err.message }));
                return;
            }

            const result = await res.json() as any;
            if (!result.success) {
                player.ws?.send(JSON.stringify({ type: "ERROR", payload: result.error }));
                return;
            }

            // 2. Update State
            const previousState = this.gameState;
            this.gameState = result.nextState;

            // 3. Update History
            // Construct HistoryEvent
            // Note: In a full implementation, we might want the Game Worker to return the description
            // For M0, we construct a basic one.
            const historyEvent = {
                turn: (previousState as any).turn || 0, // Assuming state has turn, fallback to 0
                role_id: player.role,
                action: actionPayload,
                timestamp: new Date().toISOString(),
                description: `Player ${player.role} performed ${actionPayload.action_id}`
            };
            this.history.push(historyEvent);

            await this.state.storage.put("gameState", this.gameState);
            await this.state.storage.put("history", this.history);

            // 4. Broadcast
            await this.broadcastState();

        } catch (e: any) {
            player.ws?.send(JSON.stringify({ type: "ERROR", payload: "Game Worker Error: " + e.message }));
        }
    }

    // Broadcast State (as Perspective)
    async broadcastState() {
        if (!this.config || !this.gameState) return;

        // Group players by role to minimize fetch calls
        const roleGroups = new Map<string, WebSocket[]>();
        for (const player of this.players.values()) {
            if (!player.ws) continue;
            const role = player.role || 'spectator'; // Default to spectator if null
            if (!roleGroups.has(role)) {
                roleGroups.set(role, []);
            }
            roleGroups.get(role)!.push(player.ws);
        }

        // Fetch perspective for each role and broadcast
        // We include 'spectator' implicitly if any player has 'spectator' role
        for (const [roleId, sockets] of roleGroups.entries()) {
            try {
                // Call Game Worker to generate perspective
                const res = await fetch(`${this.config.gameWorkerUrl}/perspective`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        state: this.gameState,
                        roleId: roleId,
                        wholeHistory: this.history,
                        diffHistory: [] // For M0 we ignore diffHistory optimization
                    }),
                });

                if (!res.ok) {
                    console.error(`Failed to generate perspective for ${roleId}`);
                    continue;
                }

                const perspective = await res.json();
                const msg = JSON.stringify({
                    type: "STATE_UPDATE",
                    payload: perspective
                });

                for (const ws of sockets) {
                    ws.send(msg);
                }

            } catch (e) {
                console.error(`Error broadcasting to ${roleId}`, e);
            }
        }
    }

    async sendPerspective(ws: WebSocket, player: Player) {
        if (!this.gameState || !this.config) return;

        try {
            const res = await fetch(`${this.config.gameWorkerUrl}/perspective`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    state: this.gameState,
                    roleId: player.role || 'spectator',
                    wholeHistory: this.history,
                    diffHistory: []
                }),
            });

            if (res.ok) {
                const perspective = await res.json();
                ws.send(JSON.stringify({
                    type: "STATE_UPDATE",
                    payload: perspective
                }));
            }
        } catch (e) {
            console.error("Failed to send initial perspective", e);
        }
    }
}
