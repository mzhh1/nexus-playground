import { BaseManager } from "./base";
import { ClientEngineState, ClientPlayerInfo, ServerMessage, ClientMessage } from "../types";
import { getRoleForUser } from "../game-do";

const SPECTATOR_ROLE_ID = "nexus_reserved_specator";

export class PresenceManager extends BaseManager {
    public async handleSession(
        ws: WebSocket,
        userId: string,
        displayName: string,
    ): Promise<void> {
        ws.accept();

        const isOwner = userId === this.room.ownerId;

        const isAlreadyMember = !!this.room.players[userId];
        if (isAlreadyMember) {
            this.room.players[userId].connected = true;
            // If the user already has a name in the engine, don't let the JWT name (which might be a placeholder) overwrite it.
            if (!this.room.players[userId].displayName) {
                this.room.players[userId].displayName = displayName;
            }
        } else if (isOwner) {
            // Register owner if not already there
            this.room.players[userId] = {
                displayName,
                connected: true,
                isOwner: true,
                type: "human",
            };
        }

        // Track connection
        // Close old WS if the same user reconnects
        const oldWs = this.room.sessions.get(userId);
        if (oldWs) {
            try {
                oldWs.close(1000, "Replaced by new connection");
            } catch (_) { /* ignore */ }
            this.room.connections.delete(oldWs);
        }

        this.room.connections.set(ws, userId);
        this.room.sessions.set(userId, ws);

        await this.room.persist("players");

        // Send current state ONLY to the connecting client
        this.sendSyncState(ws, userId);

        // Broadcast to OTHER clients only if this user is a member (state changed for them)
        if (isAlreadyMember || isOwner) {
            this.broadcastSyncStateExcept(userId);
        }

        // Message handler
        ws.addEventListener("message", async (event) => {
            try {
                const data =
                    typeof event.data === "string"
                        ? JSON.parse(event.data)
                        : null;
                if (!data || !data.type) return;
                await this.room.handleMessage(userId, data as ClientMessage);
            } catch (e) {
                console.error(`[PresenceManager] Error handling message from ${userId}:`, e);
                this.sendError(ws, "Failed to process message" + e);
            }
        });

        // Close handler
        ws.addEventListener("close", async () => {
            this.room.connections.delete(ws);
            this.room.sessions.delete(userId);

            if (this.room.players[userId]) {
                this.room.players[userId].connected = false;
                await this.room.persist("players");
            }

            // Only broadcast to remaining clients
            this.broadcastSyncState();
        });

        ws.addEventListener("error", () => {
            this.room.connections.delete(ws);
            this.room.sessions.delete(userId);
            if (this.room.players[userId]) {
                this.room.players[userId].connected = false;
            }
        });
    }

    public broadcastSyncState(): void {
        for (const [ws, userId] of this.room.connections.entries()) {
            this.sendSyncState(ws, userId);
        }
    }

    /** Broadcast to all connected clients EXCEPT the specified user */
    public broadcastSyncStateExcept(excludeUserId: string): void {
        for (const [ws, userId] of this.room.connections.entries()) {
            if (userId !== excludeUserId) {
                this.sendSyncState(ws, userId);
            }
        }
    }

    public async sendSyncState(ws: WebSocket, userId: string): Promise<void> {
        const engineState = this.generateClientState(userId);

        // Get game perspective for this user's role
        let gamePerspective: any | null = null;
        if (this.room.phase === "playing" || this.room.phase === "finished" || this.room.phase === "paused") {
            const roleId = getRoleForUser(this.room.roleMapping, userId) || SPECTATOR_ROLE_ID;
            gamePerspective = await this.room.fetchPerspective(roleId);
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

    public generateClientState(userId: string): ClientEngineState {
        const isAuthorized = !!this.room.players[userId] || userId === this.room.ownerId;

        const clientPlayers: Record<string, ClientPlayerInfo> = {};
        if (isAuthorized) {
            for (const [uid, p] of Object.entries(this.room.players)) {
                clientPlayers[uid] = {
                    displayName: p.displayName,
                    connected: p.connected,
                    isOwner: p.isOwner,
                    type: p.type,
                    role: getRoleForUser(this.room.roleMapping, uid),
                    modelName: p.llmConfig?.modelName,
                };
            }
        }

        return {
            roomId: this.room.roomId,
            ownerId: isAuthorized ? this.room.ownerId : "",
            ownerDisplayName: isAuthorized ? this.room.ownerDisplayName : "Room Owner",
            name: isAuthorized ? this.room.name : "",
            isPublic: isAuthorized ? this.room.isPublic : true,
            phase: isAuthorized ? this.room.phase : ("authorized_check" as any),
            players: clientPlayers,
            gameConfig: isAuthorized && this.room.gameConfig
                ? {
                    gameId: this.room.gameConfig.gameId,
                    maxPlayers: this.room.gameConfig.maxPlayers,
                    roleIds: this.room.gameConfig.roleIds,
                    auto_save_mode: this.room.gameConfig.auto_save_mode,
                }
                : null,
            stateHistory: isAuthorized ? this.room.stateHistory.map(({ index, name, timestamp }) => ({
                index,
                name,
                timestamp,
            })) : [],
            runtimeId: this.room.runtimeId,
            stateIndex: this.room.stateIndex,
            you: {
                userId,
                isOwner: userId === this.room.ownerId,
                role: getRoleForUser(this.room.roleMapping, userId),
                isAuthorized,
            },
        };
    }

    public sendMessage(ws: WebSocket, msg: ServerMessage): void {
        try {
            ws.send(JSON.stringify(msg));
        } catch (e) {
            console.error("[PresenceManager] Failed to send message:", e);
        }
    }

    public sendError(ws: WebSocket, message: string): void {
        this.sendMessage(ws, { type: "ERROR", payload: message });
    }

    public sendErrorToUser(userId: string, message: string): void {
        const ws = this.room.sessions.get(userId);
        if (ws) {
            this.sendError(ws, message);
        }
    }
}
