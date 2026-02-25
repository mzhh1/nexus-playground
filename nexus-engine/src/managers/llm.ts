import { BaseManager } from "./base";
import { generateLlmUserId } from "../game-do";
import { LlmWebhookRequest, LlmWebhookResponse, InteractionStatus } from "../types";
import { insertMonitorLog } from "../monitor-store";
import { TASK_PROMPT_NO_MEMORY, TASK_PROMPT_WITH_MEMORY, NO_TASK_PROMPT_WITH_MEMORY } from "./task-prompts";
import { applySuccessfulAction } from "./action-processor";

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
        if (!this.room.llmWebhookUrl) {
            console.warn(`[LlmManager] Skipping LLM call: LLM_WEBHOOK_URL is not configured (roomId: ${this.room.roomId})`);
            return;
        }

        const userId = this.room.roleMapping[roleId];
        const player = this.room.players[userId];
        if (!player || player.type !== "llm" || !player.llmConfig) {
            console.warn(`[LlmManager] Skipping LLM call: role ${roleId} is not mapped to an LLM player`);
            return;
        }

        console.log(`[LlmManager] Calling LLM webhook for role ${roleId} (attempt: ${retryCount + 1})`);
        const interactionGroupId = crypto.randomUUID();
        const interactionId = crypto.randomUUID();
        const startTs = Date.now();

        try {
            const perspective = await this.room.fetchPerspective(roleId);
            if (!perspective) {
                throw new Error("Failed to fetch perspective from game worker");
            }

            const statePrompt = await this.room.fetchStatePrompt(perspective);

            const hasActions = perspective.action_space_definition?.actions?.length > 0;
            const memoryEnabled = !!player.llmConfig.memory || player.llmConfig.memory === "";

            // Handle empty action list
            if (!hasActions) {
                if (!memoryEnabled) {
                    console.log(`[LlmManager] Skipping turn for ${roleId}: No actions and memory disabled`);
                    return;
                }
                console.log(`[LlmManager] No actions available, but memory enabled. Calling LLM for memory-only update.`);
            }

            const userPrompt = this.buildUserPrompt(roleId, perspective, player.llmConfig, statePrompt || undefined);

            const reqBody: LlmWebhookRequest = {
                roomId: this.room.roomId,
                roleId,
                gameId: this.room.gameConfig?.gameId || "",
                perspective,
                statePrompt: userPrompt,
                llmConfig: player.llmConfig,
                attempt: retryCount + 1,
                maxAttempts: 3,
            };

            const response = await fetch(this.room.llmWebhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-engine-secret": this.room.bindings.LLM_WEBHOOK_SECRET || ""
                },
                body: JSON.stringify(reqBody),
            });

            if (!response.ok) {
                const errorText = await response.text();
                await this.logLlmInteraction(
                    interactionId,
                    interactionGroupId,
                    roleId,
                    userId,
                    player,
                    userPrompt,
                    null,
                    null,
                    "failed",
                    errorText,
                    Date.now() - startTs,
                    retryCount + 1
                );
                throw new Error(`Webhook failed: ${response.statusText} - ${errorText}`);
            }

            const resultJson = (await response.json()) as { content: string };
            const rawContent = resultJson.content;

            let result: LlmWebhookResponse;
            try {
                result = this.parseLlmOutput(rawContent);
            } catch (err: any) {
                await this.logLlmInteraction(
                    interactionId,
                    interactionGroupId,
                    roleId,
                    userId,
                    player,
                    userPrompt,
                    rawContent,
                    null,
                    "rejected",
                    `Parse failed: ${err.message}. Raw: ${rawContent.slice(0, 500)}`,
                    Date.now() - startTs,
                    retryCount + 1
                );
                throw err;
            }

            // Validate action if present
            if (hasActions) {
                const validation = this.validateAction(result.action, perspective);
                if (!validation.valid) {
                    const errorMsg = validation.error || "Generated action did not pass validation";
                    console.error(`[LlmManager] Action validation failed for ${roleId}:`, errorMsg);
                    await this.logLlmInteraction(
                        interactionId,
                        interactionGroupId,
                        roleId,
                        userId,
                        player,
                        userPrompt,
                        rawContent,
                        result,
                        "rejected",
                        errorMsg,
                        Date.now() - startTs,
                        retryCount + 1
                    );

                    // Trigger retry on validation failure
                    if (retryCount < 2) {
                        return this.callLlmWebhook(roleId, retryCount + 1);
                    }
                    return;
                }
            }

            // Apply action
            let duration = Date.now() - startTs;
            let actionResult: any = null;
            if (hasActions) {
                actionResult = await this.room.submitActionToGameWorker(roleId, result.action);
                duration = Date.now() - startTs;

                if (!actionResult.success) {
                    console.error(`[LlmManager] Action rejected by worker for ${roleId}:`, actionResult.error);
                    await this.logLlmInteraction(
                        interactionId,
                        interactionGroupId,
                        roleId,
                        userId,
                        player,
                        userPrompt,
                        rawContent,
                        result,
                        "rejected",
                        actionResult.error,
                        duration,
                        retryCount + 1
                    );
                    return;
                }

            }

            // Update memory
            if (result.memoryUpdate) {
                player.llmConfig.memory = this.room.applyMemoryUpdate(
                    player.llmConfig.memory,
                    result.memoryUpdate,
                );
            }

            // Log Success
            await this.logLlmInteraction(
                interactionId,
                interactionGroupId,
                roleId,
                userId,
                player,
                userPrompt,
                rawContent,
                result,
                "success",
                null,
                duration,
                retryCount + 1
            );

            const persistPlayers = !!result.memoryUpdate;
            if (hasActions && actionResult?.success) {
                await applySuccessfulAction({
                    room: this.room,
                    roleId,
                    action: result.action,
                    nextState: actionResult.nextState,
                    commands: actionResult.commands,
                    persistExtraKeys: persistPlayers ? ["players"] : [],
                    triggerMode: "waitUntil",
                });
            } else {
                if (persistPlayers) {
                    await this.room.persist("players");
                }
                this.room.broadcastSyncState();
                this.room.waitUntil(this.room.checkAndTriggerNextTurn());
            }

            console.log(`[LlmManager] Successfully processed LLM turn for ${roleId}${hasActions ? " (action applied)" : " (memory only)"}`);
        } catch (e: any) {
            console.error(`[LlmManager] LLM turn failed for ${roleId}:`, e);

            const duration = Date.now() - startTs;
            const perspective = await this.room.fetchPerspective(roleId).catch(() => null);
            const fallbackPrompt = perspective ? this.buildUserPrompt(roleId, perspective, player.llmConfig) : "(failed to generate prompt)";

            await this.logLlmInteraction(
                interactionId,
                interactionGroupId,
                roleId,
                userId,
                player,
                fallbackPrompt,
                null,
                null,
                "failed",
                e.message || String(e),
                duration,
                retryCount + 1
            );

            if (retryCount < 2) {
                const delay = 1000 * (retryCount + 1);
                console.log(`[LlmManager] Retrying in ${delay}ms...`);
                await this.room.sleep(delay);
                return this.callLlmWebhook(roleId, retryCount + 1);
            }
        }
    }

    private buildUserPrompt(roleId: string, perspective: any, llmConfig: any, workerStatePrompt?: string): string {
        // 1. state_prompt (from game logic)
        let statePrompt = "";
        if (workerStatePrompt) {
            statePrompt = workerStatePrompt;
        } else {
            statePrompt = perspective.message ? `# 环境信息\n${perspective.message}\n\n` : '';
            statePrompt += `# 当前游戏状态\n${JSON.stringify(perspective.current_state, null, 2)}`;
        }

        // 2. memory (from system)
        const memoryEnabled = (llmConfig.memory !== undefined && llmConfig.memory !== null) && (this.room.gameConfig?.enable_llm_memory !== false);
        const memorySection = memoryEnabled ? `\n\n# 🧠 你的记忆\n以下是你在本局游戏中积累的个人记忆和推理笔记：\n\n${llmConfig.memory || '(暂无记忆)'}\n\n---` : '';

        // 3. action_prompt (system generated based on action list)
        const hasActions = perspective.action_space_definition?.actions?.length > 0;
        let actionPrompt = '';
        if (hasActions) {
            const actionsText = perspective.action_space_definition.actions.map((a: any) => {
                let text = `- action_id: "${a.action_id}"\n  描述: ${a.description}`;
                if (a.params_schema && Object.keys(a.params_schema).length > 0) {
                    const paramsLines = Object.entries(a.params_schema)
                        .map(([key, schema]: [string, any]) => {
                            let line = `    * ${key} (${schema.type}): ${schema.description || ''}`;
                            if (schema.minimum !== undefined || schema.maximum !== undefined) line += ` [范围: ${schema.minimum}-${schema.maximum}]`;
                            if (schema.enum) line += ` [可选值: ${schema.enum.join(', ')}]`;
                            return line;
                        })
                        .join('\n');
                    text += `\n  参数:\n${paramsLines}`;
                } else {
                    text += `\n  参数: 无`;
                }
                return text;
            }).join('\n\n');

            actionPrompt = `\n\n# 可用行动列表\n${actionsText}\n\n`;
            actionPrompt += memoryEnabled ? TASK_PROMPT_WITH_MEMORY : TASK_PROMPT_NO_MEMORY;
        } else {
            actionPrompt = `\n\n# 系统提示\n当前没有你可以执行的行动。`;
            if (memoryEnabled) {
                actionPrompt += `\n\n${NO_TASK_PROMPT_WITH_MEMORY}`;
            }
        }

        return `${statePrompt}${memorySection}${actionPrompt}`;
    }

    private parseLlmOutput(rawContent: string): LlmWebhookResponse {
        const jsonText = this.extractJsonFromText(rawContent);
        let parsed: any;
        try {
            parsed = JSON.parse(jsonText);
        } catch (e) {
            console.error("[LlmManager] Failed to parse JSON:", jsonText);
            throw new Error(`LLM output is not valid JSON: ${rawContent.slice(0, 200)}`);
        }

        if (!this.isRecord(parsed)) {
            throw new Error('LLM output must be a JSON object');
        }

        const rawActionId = parsed.action_id ?? parsed.actionId;
        const action_id = typeof rawActionId === 'string' ? rawActionId.trim() : "";

        const rawParams = parsed.params;
        const params = this.isRecord(rawParams) ? rawParams : {};

        let memoryUpdate: LlmWebhookResponse['memoryUpdate'];
        const rawMemoryUpdate = parsed.memory_update ?? parsed.memoryUpdate;
        if (this.isRecord(rawMemoryUpdate)) {
            const mode = rawMemoryUpdate.mode;
            const content = rawMemoryUpdate.content;
            if ((mode === 'append' || mode === 'replace') && typeof content === 'string') {
                memoryUpdate = { mode, content };
            }
        }

        return {
            action: {
                action_id,
                params,
            },
            memoryUpdate,
        };
    }

    private validateAction(
        action: { action_id: string; params: Record<string, any> },
        perspective: any
    ): { valid: boolean; error?: string } {
        const actions = perspective.action_space_definition?.actions || [];
        const actionDef = actions.find((a: any) => a.action_id === action.action_id);

        if (!actionDef) {
            return {
                valid: false,
                error: `行动ID "${action.action_id}" 不在可用行动列表中。可用：${actions.map((a: any) => a.action_id).join(', ')}`
            };
        }

        if (actionDef.params_schema && Object.keys(actionDef.params_schema).length > 0) {
            for (const [key, schema] of Object.entries(actionDef.params_schema) as [string, any][]) {
                const value = action.params[key];
                if (value === undefined) {
                    return { valid: false, error: `缺少必需参数 "${key}"` };
                }

                if (schema.type === 'number' || schema.type === 'integer') {
                    if (typeof value !== 'number') return { valid: false, error: `参数 "${key}" 应该是一个数字` };
                    if (schema.minimum !== undefined && value < schema.minimum) return { valid: false, error: `参数 "${key}" 太小 (min: ${schema.minimum})` };
                    if (schema.maximum !== undefined && value > schema.maximum) return { valid: false, error: `参数 "${key}" 太大 (max: ${schema.maximum})` };
                } else if (schema.type === 'string') {
                    if (typeof value !== 'string') return { valid: false, error: `参数 "${key}" 应该是一个字符串` };
                    if (schema.enum && !schema.enum.includes(value)) return { valid: false, error: `参数 "${key}" 的值无效。可选：${schema.enum.join(', ')}` };
                }
            }
        }

        return { valid: true };
    }

    private extractJsonFromText(raw: string): string {
        const trimmed = raw.trim();
        // Handle markdown code blocks
        const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (match?.[1]) {
            return match[1].trim();
        }
        // Fallback to searching for the first { and last }
        const firstBrace = trimmed.indexOf('{');
        const lastBrace = trimmed.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            return trimmed.slice(firstBrace, lastBrace + 1);
        }
        return trimmed;
    }

    private isRecord(value: unknown): value is Record<string, unknown> {
        return typeof value === 'object' && value !== null;
    }

    private async logLlmInteraction(
        id: string,
        groupId: string,
        roleId: string,
        userId: string,
        player: any,
        userPrompt: string,
        rawResponse: string | null,
        res: LlmWebhookResponse | null,
        status: InteractionStatus,
        error: string | null,
        duration: number,
        attempt: number
    ): Promise<void> {
        try {
            await insertMonitorLog(this.room.bindings.DB, {
                interactionId: id,
                interactionGroupId: groupId,
                roomId: this.room.roomId,
                gameId: this.room.gameConfig?.gameId,
                roleId: roleId,
                userId: userId,
                playerType: "llm",
                modelName: player.llmConfig?.modelName,
                systemPrompt: player.llmConfig?.systemPrompt,
                userPrompt: userPrompt,
                response: rawResponse,
                action_id: res?.action?.action_id,
                actionParams: res?.action?.params,
                status: status,
                attempt: attempt,
                outerAttempt: 1,
                maxAttempts: 3,
                errorMessage: error,
                responseTimeMs: duration,
                eventTs: Date.now(),
            });
        } catch (e) {
            console.error("[LlmManager] Failed to record monitor log:", e);
        }
    }
}
