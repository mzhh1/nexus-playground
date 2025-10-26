/**
 * Perspectives Routes
 * Get role perspectives and subscribe to updates via SSE
 */

import { FastifyPluginAsync } from 'fastify';
import { createStateManager } from '../runtime/state-manager';
import { createPerspectiveGenerator } from '../runtime/perspective-generator';
import { getEventBus } from '../runtime/event-bus';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

const perspectivesRoutes: FastifyPluginAsync = async (fastify) => {
  const stateManager = createStateManager(fastify);
  const perspectiveGenerator = createPerspectiveGenerator(fastify, stateManager);
  const eventBus = getEventBus();

  /**
   * GET /api/v1/rooms/:roomId/perspectives/:roleId
   * Get current perspective for a role (one-time fetch)
   */
  fastify.get<{
    Params: { roomId: string; roleId: string };
  }>('/rooms/:roomId/perspectives/:roleId', async (request, reply) => {
    const { roomId, roleId } = request.params;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    try {
      // Generate perspective
      const perspective = await perspectiveGenerator.generatePerspective(roomId, roleId);

      if (!perspective) {
        return reply.code(404).send({ error: 'Perspective not found' });
      }

      return reply.send(perspective);
    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to get perspective');
      return reply.code(500).send({ error: 'Failed to get perspective' });
    }
  });

  /**
   * GET /api/v1/rooms/:roomId/perspectives/:roleId/stream
   * Subscribe to perspective updates via Server-Sent Events (SSE)
   */
  fastify.get<{
    Params: { roomId: string; roleId: string };
    Querystring: { player_id?: string };
  }>('/rooms/:roomId/perspectives/:roleId/stream', async (request, reply) => {
    const { roomId, roleId } = request.params;
    const { player_id } = request.query;

    if (!isValidRoomId(roomId)) {
      return reply.code(400).send({ error: 'Invalid room ID format' });
    }

    try {
      // Verify room exists
      const roomState = await stateManager.getRoomState(roomId);

      if (!roomState) {
        return reply.code(404).send({ error: 'Room not found' });
      }

      // Verify role is mapped
      if (!(roleId in roomState.role_mapping)) {
        return reply.code(404).send({ error: 'Role not found or not mapped' });
      }

      logger.info(
        { roomId, roleId, playerId: player_id },
        'SSE connection established for perspective stream'
      );

      // Register SSE client
      const clientId = eventBus.registerClient(reply, roomId, roleId, player_id);

      // Send initial perspective
      const perspective = await perspectiveGenerator.generatePerspective(roomId, roleId);

      if (perspective) {
        eventBus.sendEvent(clientId, 'perspective', perspective);
      }

      // The connection stays open
      // Perspective updates will be sent via eventBus.broadcastPerspective()
      // when actions are processed

      // Note: The reply is kept open until the client disconnects
      // Cleanup is handled by event-bus.ts via 'close' event

    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to establish SSE connection');
      return reply.code(500).send({ error: 'Failed to establish SSE connection' });
    }
  });
};

export default perspectivesRoutes;

