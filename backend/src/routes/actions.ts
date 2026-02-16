/**
 * Actions Routes
 * Submit game actions (used by LLM auto-players via backend)
 *
 * NOTE: Human players now submit actions via WebSocket to the Engine DO directly.
 * This endpoint is kept for LLM auto-player actions that run server-side.
 */

import { FastifyPluginAsync } from 'fastify';
import { createStateManager } from '../runtime/state-manager.js';
import { createActionProcessor } from '../runtime/action-processor.js';
import { createAutoPlayerCoordinator } from '../runtime/auto-player-coordinator.js';
import { Action } from '../games/types.js';
import { isValidRoomId } from '../utils/room-id-generator.js';
import logger from '../utils/logger.js';

const actionsRoutes: FastifyPluginAsync = async (fastify) => {
  const stateManager = createStateManager(fastify);
  const actionProcessor = createActionProcessor(fastify, stateManager);
  const autoPlayerCoordinator = createAutoPlayerCoordinator(fastify);

  /**
   * POST /api/v1/rooms/:roomId/actions
   * Submit an action to the game
   */
  fastify.post<{
    Params: { roomId: string };
    Body: {
      action_id: string;
      params?: Record<string, any>;
      role_id: string;
    };
  }>('/rooms/:roomId/actions', async (request, reply) => {
    const { roomId } = request.params;
    const { action_id, params, role_id } = request.body;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    if (!action_id || !role_id) {
      return reply.code(400).send({ error: 'action_id and role_id are required' });
    }

    const action: Action = {
      action_id,
      params: params || {},
      role_id,
    };

    try {
      const result = await actionProcessor.processAction(roomId, action);

      if (!result.success) {
        return reply.code(400).send({
          error: result.error,
          errorCode: result.errorCode
        });
      }

      logger.info({ roomId, action }, 'Action processed successfully');

      // Trigger auto player coordinator (async, non-blocking)
      setImmediate(() => {
        autoPlayerCoordinator.checkAndExecuteCurrentTurn(roomId).catch((err) => {
          logger.error(
            { err, roomId },
            'Auto player coordination failed after action'
          );
        });
      });

      return reply.send({
        success: true,
        message: 'Action processed successfully'
      });
    } catch (error) {
      logger.error({ error, roomId, action }, 'Failed to process action');
      return reply.code(500).send({ error: 'Failed to process action' });
    }
  });
};

export default actionsRoutes;
