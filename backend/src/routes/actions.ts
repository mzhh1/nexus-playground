/**
 * Actions Routes
 * Submit game actions
 */

import { FastifyPluginAsync } from 'fastify';
import { createStateManager } from '../runtime/state-manager';
import { createActionProcessor } from '../runtime/action-processor';
import { createPerspectiveGenerator } from '../runtime/perspective-generator';
import { getEventBus } from '../runtime/event-bus';
import { Action } from '../games/types';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

const actionsRoutes: FastifyPluginAsync = async (fastify) => {
  const stateManager = createStateManager(fastify);
  const actionProcessor = createActionProcessor(fastify, stateManager);
  const perspectiveGenerator = createPerspectiveGenerator(fastify, stateManager);
  const eventBus = getEventBus();

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

    // Construct action object
    const action: Action = {
      action_id,
      params: params || {},
      role_id,
    };

    try {
      // Process action
      const result = await actionProcessor.processAction(roomId, action);

      if (!result.success) {
        return reply.code(400).send({ 
          error: result.error,
          errorCode: result.errorCode 
        });
      }

      logger.info({ roomId, action }, 'Action processed successfully');

      // Invalidate perspective caches
      await perspectiveGenerator.invalidateAllPerspectives(roomId);

      // Generate new perspectives for all roles
      const roomState = await stateManager.getRoomState(roomId);
      
      if (roomState && roomState.game_state) {
        // Broadcast updated perspectives to all connected clients
        for (const roleId of Object.keys(roomState.role_mapping)) {
          const perspective = await perspectiveGenerator.generatePerspective(
            roomId,
            roleId,
            { skipCache: true }
          );

          if (perspective) {
            eventBus.broadcastPerspective(roomId, roleId, perspective);
          }
        }
      }

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

