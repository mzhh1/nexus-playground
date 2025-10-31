/**
 * Perspectives Protected Routes
 * Endpoints that require Bearer Token authentication via service-auth-middleware
 */

import { FastifyPluginAsync } from 'fastify';
import crypto from 'crypto';
import { createStateManager } from '../runtime/state-manager';
import { createPerspectiveGenerator } from '../runtime/perspective-generator';
import { isValidRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

const perspectivesProtectedRoutes: FastifyPluginAsync = async (fastify) => {
  const stateManager = createStateManager(fastify);
  const perspectiveGenerator = createPerspectiveGenerator(fastify, stateManager);

  /**
   * GET /api/v1/rooms/:roomId/perspectives/:roleId
   * Get current perspective for a role (one-time fetch)
   * 
   * Authentication: Requires Bearer Token (via service-auth-middleware)
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
   * POST /api/v1/rooms/:roomId/perspectives/:roleId/ticket
   * Generate a one-time ticket for SSE authentication
   * 
   * Authentication: Requires Bearer Token (via service-auth-middleware)
   * Returns: A temporary ticket that can be used to authenticate the SSE stream
   */
  fastify.post<{
    Params: { roomId: string; roleId: string };
    Querystring: { player_id?: string };
  }>('/rooms/:roomId/perspectives/:roleId/ticket', async (request, reply) => {
    const { roomId, roleId } = request.params;
    const { player_id } = request.query;
    const userId = (request as any).auth?.userId; // From authMiddleware

    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized - authentication required' });
    }

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

      // TODO: Add permission checks here (owner, assigned player, spectator, etc.)
      // For now, any authenticated user can request a ticket

      // Generate one-time ticket (32 bytes = 256 bits of randomness)
      const ticket = crypto.randomBytes(32).toString('base64url');
      const ticketKey = `sse_ticket:${ticket}`;

      // Store ticket in Redis with 5 minute TTL
      await fastify.redis.setex(
        ticketKey,
        300, // 5 minutes
        JSON.stringify({
          userId,
          roomId,
          roleId,
          playerId: player_id,
          createdAt: Date.now(),
        })
      );

      logger.info(
        { userId, roomId, roleId, playerId: player_id, ticketPrefix: ticket.substring(0, 8) },
        'SSE ticket generated'
      );

      // Build stream URL
      const baseURL = '/api/v1';
      let streamUrl = `${baseURL}/rooms/${roomId}/perspectives/${roleId}/stream?ticket=${ticket}`;
      if (player_id) {
        streamUrl += `&player_id=${player_id}`;
      }

      return reply.send({
        ticket,
        expiresIn: 300, // seconds
        streamUrl,
      });
    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to generate SSE ticket');
      return reply.code(500).send({ error: 'Failed to generate ticket' });
    }
  });
};

export default perspectivesProtectedRoutes;






