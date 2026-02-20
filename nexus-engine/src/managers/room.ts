import { BaseManager } from "./base";
import { GameWorkerMetadata } from "../types";

export class RoomManager extends BaseManager {
    public async handleSelectRole(userId: string, roleId: string | null): Promise<void> {
        if (this.room.phase !== "lobby") {
            return this.room.sendErrorToUser(userId, "Can only select roles in lobby phase");
        }

        // Remove user from any existing role
        for (const [rId, uId] of Object.entries(this.room.roleMapping)) {
            if (uId === userId) {
                delete this.room.roleMapping[rId];
            }
        }

        // Assign new role (if not null)
        if (roleId) {
            // Validate role exists in game config
            if (this.room.gameConfig && !this.room.gameConfig.roleIds.includes(roleId)) {
                return this.room.sendErrorToUser(userId, `Invalid role: ${roleId}`);
            }
            // Check role is not already taken
            if (this.room.roleMapping[roleId] && this.room.roleMapping[roleId] !== userId) {
                return this.room.sendErrorToUser(userId, `Role ${roleId} is already taken`);
            }
            this.room.roleMapping[roleId] = userId;
        }

        await this.room.persist("roleMapping");
        this.room.broadcastSyncState();
    }

    public async handleLeave(userId: string): Promise<void> {
        // Remove from role mapping
        for (const [rId, uId] of Object.entries(this.room.roleMapping)) {
            if (uId === userId) {
                delete this.room.roleMapping[rId];
            }
        }

        // Remove from players
        delete this.room.players[userId];

        // Close WS
        const ws = this.room.sessions.get(userId);
        if (ws) {
            try {
                ws.close(1000, "Left room");
            } catch (_) { /* ignore */ }
            this.room.connections.delete(ws);
            this.room.sessions.delete(userId);
        }

        await this.room.persist("players", "roleMapping");
        this.room.broadcastSyncState();
    }

    public async handleAdminSetGame(
        userId: string,
        payload: { gameId: string; gameWorkerUrl: string },
    ): Promise<void> {
        if (!this.room.requireOwner(userId)) return;
        if (this.room.phase !== "lobby") {
            return this.room.sendErrorToUser(userId, "Can only set game in lobby phase");
        }

        try {
            // Fetch metadata from Game Worker
            const metaRes = await fetch(
                `${payload.gameWorkerUrl.replace(/\/$/, "")}/metadata`,
            );
            if (!metaRes.ok) {
                return this.room.sendErrorToUser(userId, "Failed to fetch game metadata");
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

            this.room.gameConfig = {
                gameWorkerUrl: payload.gameWorkerUrl,
                gameId: payload.gameId || metadata.id,
                maxPlayers: metadata.maxPlayers || roleIds.length,
                roleIds,
            };

            // Clear role mapping since game changed
            this.room.roleMapping = {};

            await this.room.persist("gameConfig", "roleMapping");
            this.room.broadcastSyncState();
        } catch (e) {
            console.error("[RoomManager] Failed to set game:", e);
            this.room.sendErrorToUser(userId, "Failed to set game");
        }
    }

    public async handleAdminRemovePlayer(
        userId: string,
        targetUserId: string,
    ): Promise<void> {
        if (!this.room.requireOwner(userId)) return;

        if (targetUserId === this.room.ownerId) {
            return this.room.sendErrorToUser(userId, "Cannot remove the room owner");
        }

        if (!this.room.players[targetUserId]) {
            return this.room.sendErrorToUser(userId, "Player not found");
        }

        // Remove from role mapping
        for (const [rId, uId] of Object.entries(this.room.roleMapping)) {
            if (uId === targetUserId) {
                delete this.room.roleMapping[rId];
            }
        }

        // Remove from players
        delete this.room.players[targetUserId];

        // Kick if connected
        const targetWs = this.room.sessions.get(targetUserId);
        if (targetWs) {
            this.room.sendMessage(targetWs, { type: "KICKED", payload: "Removed by room owner" });
            try {
                targetWs.close(1000, "Kicked");
            } catch (_) { /* ignore */ }
            this.room.connections.delete(targetWs);
            this.room.sessions.delete(targetUserId);
        }

        await this.room.persist("players", "roleMapping");
        this.room.broadcastSyncState();
    }

    public async handleAdminAssignRole(
        userId: string,
        payload: { roleId: string; userId: string },
    ): Promise<void> {
        if (!this.room.requireOwner(userId)) return;
        if (this.room.phase !== "lobby") {
            return this.room.sendErrorToUser(userId, "Can only assign roles in lobby phase");
        }

        if (!this.room.players[payload.userId]) {
            return this.room.sendErrorToUser(userId, `Player ${payload.userId} not found`);
        }

        if (this.room.gameConfig && !this.room.gameConfig.roleIds.includes(payload.roleId)) {
            return this.room.sendErrorToUser(userId, `Invalid role: ${payload.roleId}`);
        }

        // Remove the target user from any existing role
        for (const [rId, uId] of Object.entries(this.room.roleMapping)) {
            if (uId === payload.userId) {
                delete this.room.roleMapping[rId];
            }
        }

        // Remove anyone else from this role
        delete this.room.roleMapping[payload.roleId];

        // Assign
        this.room.roleMapping[payload.roleId] = payload.userId;

        await this.room.persist("roleMapping");
        this.room.broadcastSyncState();
    }
}
