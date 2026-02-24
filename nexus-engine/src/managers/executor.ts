import { BaseManager } from "./base";
import { getRoleForUser } from "../game-do";
import { insertMonitorLog } from "../monitor-store";
import { applySuccessfulAction } from "./action-processor";
import { resolveGameWorkerClient } from "../runtime/game-worker-client";

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
            const client = resolveGameWorkerClient(
                this.room.gameConfig.gameId,
                this.room.gameConfig.gameWorkerUrl,
                this.room.bindings
            );

            const initRes = await client.fetch("/init", {
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
            this.room.runtimeId = crypto.randomUUID();
            this.room.stateIndex = 0;
            this.room.stateHistory = [{
                index: 0,
                name: "Initial State",
                state: this.room.gameState,
                timestamp: Date.now(),
            }];
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
        this.room.stateHistory = [];

        await this.room.persist("phase", "gameState", "history", "stateHistory");
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
            const client = resolveGameWorkerClient(
                this.room.gameConfig.gameId,
                this.room.gameConfig.gameWorkerUrl,
                this.room.bindings
            );
            const initRes = await client.fetch("/init", {
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
            this.room.runtimeId = crypto.randomUUID();
            this.room.stateIndex = 0;
            this.room.stateHistory = [{
                index: 0,
                name: "Initial State",
                state: this.room.gameState,
                timestamp: Date.now(),
            }];
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
            this.room.waitUntil(insertMonitorLog(this.room.bindings.DB, {
                ...baseHumanLog,
                status: "rejected",
                errorMessage: result.error || "Action rejected",
            }));
            return this.room.sendErrorToUser(userId, result.error || "Action rejected");
        }

        this.room.waitUntil(insertMonitorLog(this.room.bindings.DB, {
            ...baseHumanLog,
            status: "success",
        }));

        await applySuccessfulAction({
            room: this.room,
            roleId,
            action: { action_id: payload.action_id, params: payload.params || {} },
            nextState: result.nextState,
            commands: result.commands,
            triggerMode: "await",
        });

        console.log(`[GameExecutor] Action processed for ${userId} (${roleId}), checking next turn...`);
    }
}
