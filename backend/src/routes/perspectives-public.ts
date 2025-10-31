/**
 * Perspectives Public Routes
 * SSE streaming endpoint that uses ticket-based authentication
 * This route does NOT use the service-auth-middleware
 */

import { FastifyPluginAsync } from 'fastify';
import { createStateManager } from '../runtime/state-manager';
import { createPerspectiveGenerator } from '../runtime/perspective-generator';
import { getEventBus } from '../runtime/event-bus';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

const perspectivesPublicRoutes: FastifyPluginAsync = async (fastify) => {
  const stateManager = createStateManager(fastify);
  const perspectiveGenerator = createPerspectiveGenerator(fastify, stateManager);
  const eventBus = getEventBus();

  /**
   * GET /api/v1/rooms/:roomId/perspectives/:roleId/stream
   * Subscribe to perspective updates via Server-Sent Events (SSE)
   * 
   * Authentication: Uses one-time ticket (not Bearer Token)
   * This endpoint is registered outside of the auth middleware scope
   */
  fastify.get<{
    Params: { roomId: string; roleId: string };
    Querystring: { player_id?: string; ticket?: string };
  }>(
    '/rooms/:roomId/perspectives/:roleId/stream',
    async (request, reply) => {
      const { roomId, roleId } = request.params;
      const { player_id, ticket } = request.query;

      // ===== Ticket Authentication =====
      if (!ticket) {
        return reply.code(401).send({ error: 'Missing authentication ticket' });
      }

      const ticketKey = `sse_ticket:${ticket}`;
      const ticketDataRaw = await fastify.redis.get(ticketKey);

      if (!ticketDataRaw) {
        logger.warn({ ticketPrefix: ticket.substring(0, 8) }, 'Invalid or expired SSE ticket');
        return reply.code(401).send({ error: 'Invalid or expired ticket' });
      }

      let ticketData: {
        userId: string;
        roomId: string;
        roleId: string;
        playerId?: string;
        createdAt: number;
      };

      try {
        ticketData = JSON.parse(ticketDataRaw);
      } catch (error) {
        logger.error({ error, ticket: ticket.substring(0, 8) }, 'Failed to parse ticket data');
        return reply.code(500).send({ error: 'Invalid ticket format' });
      }

      // Verify ticket matches request parameters
      if (ticketData.roomId !== roomId || ticketData.roleId !== roleId) {
        logger.warn(
          {
            ticketRoomId: ticketData.roomId,
            ticketRoleId: ticketData.roleId,
            requestRoomId: roomId,
            requestRoleId: roleId,
          },
          'Ticket does not match requested resource'
        );
        return reply.code(403).send({ error: 'Ticket does not match requested resource' });
      }

      // Note: We do NOT delete the ticket here to allow reconnections
      // The ticket will expire naturally via Redis TTL

      // ===== SSE Stream Setup =====
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
          {
            userId: ticketData.userId,
            roomId,
            roleId,
            playerId: player_id,
            ticketAge: Date.now() - ticketData.createdAt,
          },
          'SSE connection authenticated via ticket'
        );

        // Register SSE client (with userId for audit)
        const clientId = eventBus.registerClient(reply, roomId, roleId, player_id, ticketData.userId);

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
    }
  );
};

export default perspectivesPublicRoutes;






