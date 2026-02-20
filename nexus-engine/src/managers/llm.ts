import { BaseManager } from "./base";
import { generateLlmUserId } from "../game-do";
import { LlmWebhookRequest, LlmWebhookResponse } from "../types";

export class LlmManager extends BaseManager {
    public async handleAdminAddBot(
        userId: string,
        payload: {
            displayName: string;
            modelName: string;
            systemPrompt?: string;
            temperature?: number;
        },
    ): Promise<void> {
        if (!this.room.requireOwner(userId)) return;
        if (this.room.phase !== "lobby") {
            return this.room.sendErrorToUser(userId, "Can only add bots in lobby phase");
        }

        const llmUserId = generateLlmUserId(payload.modelName);
        this.room.players[llmUserId] = {
            displayName: payload.displayName,
            connected: false,
            isOwner: false,
            type: "llm",
            llmConfig: {
                modelName: payload.modelName,
                systemPrompt: payload.systemPrompt || "你是一个聪明的游戏玩家",
                temperature: payload.temperature ?? 0.7,
                memory: "",
            },
        };

        await this.room.persist("players");
        this.room.broadcastSyncState();
    }

    public async callLlmWebhook(roleId: string, retryCount = 0): Promise<void> {
        if (!this.room.llmWebhookUrl) return;

        const userId = this.room.roleMapping[roleId];
        const player = this.room.players[userId];
        if (!player || player.type !== "llm" || !player.llmConfig) return;

        const interactionGroupId = crypto.randomUUID();
        const startTs = Date.now();

        try {
            const perspective = await this.room.fetchPerspective(roleId);
            const reqBody: LlmWebhookRequest = {
                roomId: this.room.roomId,
                roleId,
                gameId: this.room.gameConfig?.gameId || "",
                perspective,
                llmConfig: player.llmConfig,
                attempt: retryCount + 1,
                maxAttempts: 3,
            };

            const response = await fetch(this.room.llmWebhookUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reqBody),
            });

            if (!response.ok) {
                throw new Error(`Webhook failed: ${response.statusText}`);
            }

            const result = (await response.json()) as LlmWebhookResponse;

            // Apply action
            await this.room.submitActionToGameWorker(roleId, result.action);

            // Update memory
            if (result.memoryUpdate) {
                player.llmConfig.memory = this.room.applyMemoryUpdate(
                    player.llmConfig.memory,
                    result.memoryUpdate,
                );
            }

            await this.room.persist("players", "gameState", "history");
            (this.room as any).broadcastSyncState();

            // Trigger next turn if applicable
            await this.room.checkAndTriggerNextTurn();
        } catch (e) {
            console.error("[LlmManager] Webhook call failed:", e);
            if (retryCount < 2) {
                await this.room.sleep(1000 * (retryCount + 1));
                return this.callLlmWebhook(roleId, retryCount + 1);
            }
        }
    }
}
