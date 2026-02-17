/**
 * LLM Webhook Route
 *
 * Stateless endpoint called by the Nexus Engine (Cloudflare DO)
 * when it's an LLM player's turn. Receives the perspective and
 * llmConfig, calls a LLM API, and returns the action.
 *
 * Auth: X-Engine-Secret header (shared secret between Engine and Backend)
 */

import { FastifyPluginAsync } from 'fastify';
import { createLLMExecutor } from '../runtime/llm-executor.js';
import logger from '../utils/logger.js';
import { randomUUID } from 'node:crypto';

interface LlmWebhookBody {
    roomId: string;
    roleId: string;
    gameId: string;
    perspective: any;
    llmConfig: {
        modelName: string;
        systemPrompt: string;
        temperature: number;
        memory: string | null;
    };
    attempt: number;
    maxAttempts: number;
    previousError?: string;
}

const llmWebhookRoute: FastifyPluginAsync = async (fastify) => {
    const llmExecutor = createLLMExecutor(fastify);

    // Shared secret from env — Engine sends this in X-Engine-Secret header
    const webhookSecret = process.env.LLM_WEBHOOK_SECRET || process.env.NEXUS_ENGINE_ADMIN_SECRET || 'dev-webhook-secret-123';

    fastify.post<{ Body: LlmWebhookBody }>('/webhook/llm', {
        schema: {
            body: {
                type: 'object',
                required: ['roomId', 'roleId', 'gameId', 'perspective', 'llmConfig'],
                properties: {
                    roomId: { type: 'string' },
                    roleId: { type: 'string' },
                    gameId: { type: 'string' },
                    perspective: { type: 'object' },
                    llmConfig: {
                        type: 'object',
                        required: ['modelName', 'systemPrompt', 'temperature'],
                        properties: {
                            modelName: { type: 'string' },
                            systemPrompt: { type: 'string' },
                            temperature: { type: 'number' },
                            memory: { type: ['string', 'null'] },
                        },
                    },
                    attempt: { type: 'number' },
                    maxAttempts: { type: 'number' },
                    previousError: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        // 1. Auth check
        const secret = request.headers['x-engine-secret'] as string;
        if (secret !== webhookSecret) {
            logger.warn('LLM webhook: unauthorized request');
            return reply.status(401).send({ error: 'Unauthorized' });
        }

        const {
            roomId,
            roleId,
            gameId,
            perspective,
            llmConfig,
            attempt = 1,
            maxAttempts = 3,
            previousError,
        } = request.body;

        logger.info(
            { roomId, roleId, gameId, modelName: llmConfig.modelName, attempt },
            'LLM webhook: received request',
        );

        try {
            // 2. Execute LLM decision (single attempt — Engine handles retries)
            const interactionGroupId = randomUUID();
            const result = await llmExecutor.executeDecision(
                roomId,
                roleId,
                gameId,
                interactionGroupId,
                attempt,
                maxAttempts,
                perspective,
                llmConfig.modelName,
                llmConfig.systemPrompt,
                llmConfig.temperature,
                llmConfig.memory ?? null,
                previousError,
            );

            // 3. Return result
            if ('error' in result) {
                logger.warn(
                    { roomId, roleId, error: result.error, logId: result.logId },
                    'LLM webhook: execution failed',
                );
                return reply.status(422).send({
                    error: result.error,
                    logId: result.logId,
                });
            }

            logger.info(
                { roomId, roleId, actionId: result.action.action_id, logId: result.logId },
                'LLM webhook: execution succeeded',
            );

            return reply.send({
                action: {
                    actionId: result.action.action_id,
                    params: result.action.params || {},
                },
                memoryUpdate: result.memory_update
                    ? {
                        mode: result.memory_update.mode,
                        content: result.memory_update.content,
                    }
                    : undefined,
            });
        } catch (error) {
            logger.error({ error, roomId, roleId }, 'LLM webhook: unexpected error');
            return reply.status(500).send({
                error: error instanceof Error ? error.message : 'Internal server error',
            });
        }
    });
};

export default llmWebhookRoute;
