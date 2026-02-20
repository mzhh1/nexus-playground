import { BaseManager } from "./base";
import { getRoleForUser } from "../game-do";
import { insertMonitorLog } from "../monitor-store";

export class GameExecutor extends BaseManager {
    public async handleAdminStartGame(userId: string): Promise<void> {
        if (!this.room.requireOwner(userId)) return;
        if (this.room.phase !== "lobby" && this.room.phase !== "finished") {
            return this.room.sendErrorToUser(userId, "Game cannot be started in current phase");
        }
        if (!this.room.gameConfig) {
            return this.room.sendErrorToUser(userId, "No game selected");
        }

        // Validate all roles assigned
        const missingRoles = this.room.gameConfig.roleIds.filter(
            (rId) => !this.room.roleMapping[rId],
        );
        if (missingRoles.length > 0) {
            return this.room.sendErrorToUser(
                userId,
                `Missing role assignments: ${missingRoles.join(", ")}`,
            );
        }

        try {
            // Clear LLM memory
            for (const player of Object.values(this.room.players)) {
                if (player.type === "llm" && player.llmConfig) {
                    player.llmConfig.memory = "";
                }
            }

            // Initialize game state via Game Worker
            const baseUrl = this.room.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const initRes = await fetch(`${baseUrl}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    players: this.room.gameConfig.roleIds,
                }),
            });

            if (!initRes.ok) {
                const errText = await initRes.text();
                return this.room.sendErrorToUser(
                    userId,
                    `Game Worker init failed: ${errText}`,
                );
            }

            this.room.gameState = await initRes.json();
            this.room.history = [];
            this.room.phase = "playing";

            await this.room.persistAll();
            this.room.broadcastSyncState();

            // Check if first turn is LLM
            await this.room.checkAndTriggerNextTurn();
        } catch (e) {
            console.error("[GameExecutor] Failed to start game:", e);
            this.room.sendErrorToUser(userId, "Failed to start game");
        }
    }

    public async handleAdminStopGame(userId: string): Promise<void> {
        if (!this.room.requireOwner(userId)) return;
        if (this.room.phase === "lobby") {
            return this.room.sendErrorToUser(userId, "Game has not started");
        }

        this.room.phase = "lobby";
        this.room.gameState = null;
        this.room.history = [];

        await this.room.persist("phase", "gameState", "history");
        this.room.broadcastSyncState();
    }

    public async handleAdminRestartGame(userId: string): Promise<void> {
        if (!this.room.requireOwner(userId)) return;
        if (this.room.phase !== "playing" && this.room.phase !== "paused" && this.room.phase !== "finished") {
            return this.room.sendErrorToUser(userId, "Nothing to restart");
        }
        if (!this.room.gameConfig) {
            return this.room.sendErrorToUser(userId, "No game selected");
        }

        try {
            // Clear LLM memory
            for (const player of Object.values(this.room.players)) {
                if (player.type === "llm" && player.llmConfig) {
                    player.llmConfig.memory = "";
                }
            }

            // Re-initialize game state
            const baseUrl = this.room.gameConfig.gameWorkerUrl.replace(/\/$/, "");
            const initRes = await fetch(`${baseUrl}/init`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    players: Object.keys(this.room.roleMapping),
                }),
            });

            if (!initRes.ok) {
                return this.room.sendErrorToUser(userId, "Game Worker init failed on restart");
            }

            this.room.gameState = await initRes.json();
            this.room.history = [];
            this.room.phase = "playing";

            await this.room.persistAll();
            this.room.broadcastSyncState();

            await this.room.checkAndTriggerNextTurn();
        } catch (e) {
            console.error("[GameExecutor] Failed to restart game:", e);
            this.room.sendErrorToUser(userId, "Failed to restart game");
        }
    }

    public async handleAction(
        userId: string,
        payload: { action_id: string; params?: Record<string, any> },
    ): Promise<void> {
        const startedAt = Date.now();
        if (this.room.phase !== "playing") {
            return this.room.sendErrorToUser(userId, "Game is not in playing phase");
        }
        if (!this.room.gameConfig || !this.room.gameState) {
            return this.room.sendErrorToUser(userId, "Game not initialized");
        }

        const roleId = getRoleForUser(this.room.roleMapping, userId);
        if (!roleId) {
            return this.room.sendErrorToUser(userId, "You don't have a role assigned");
        }

        const currentRoleId = await this.room.getCurrentRole();
        if (currentRoleId !== roleId) {
            return this.room.sendErrorToUser(userId, "Not your turn");
        }
        //console.log("[GameExecutor] Submitting action to game worker:", payload.action_id, payload.params);
        const result = await this.room.submitActionToGameWorker(roleId, {
            action_id: payload.action_id,
            params: payload.params || {},
        });

        const interactionId = crypto.randomUUID();
        const baseHumanLog = {
            interactionId,
            interactionGroupId: interactionId,
            roomId: this.room.roomId,
            gameId: this.room.gameConfig.gameId || null,
            gameName: null,
            roleId,
            userId,
            playerType: "human" as const,
            modelName: null,
            systemPrompt: null,
            userPrompt: null,
            response: JSON.stringify({ action_id: payload.action_id, params: payload.params || {} }),
            action_id: payload.action_id,
            actionParams: payload.params || {},
            attempt: 1,
            outerAttempt: 1,
            maxAttempts: 1,
            previousError: null,
            responseTimeMs: Date.now() - startedAt,
            eventTs: Date.now(),
        };

        if (!result.success) {
            await insertMonitorLog(this.room.bindings.DB, {
                ...baseHumanLog,
                status: "rejected",
                errorMessage: result.error || "Action rejected",
            });
            return this.room.sendErrorToUser(userId, result.error || "Action rejected");
        }

        await insertMonitorLog(this.room.bindings.DB, {
            ...baseHumanLog,
            status: "success",
        });

        this.room.gameState = result.nextState;
        this.room.history.push({
            turn: this.room.history.length,
            roleId,
            action: { action_id: payload.action_id, params: payload.params || {} },
            timestamp: Date.now(),
        });

        await this.room.persist("gameState", "history");
        this.room.broadcastSyncState();

        console.log(`[GameExecutor] Action processed for ${userId} (${roleId}), checking next turn...`);
        await this.room.checkAndTriggerNextTurn();
    }
}
