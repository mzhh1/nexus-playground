/**
 * Event Bus
 * Manages Server-Sent Events (SSE) for real-time perspective updates
 */

import { FastifyReply, FastifyInstance } from 'fastify';
import { RolePerspective } from '../games/types.js';
import logger from '../utils/logger.js';

export interface SSEClient {
  reply: FastifyReply;
  roomId: string;
  roleId: string;
  playerId?: string;
  userId?: string; // For audit logging
  connectedAt: Date;
}

interface PlayerConnectionInfo {
  roomId: string;
  clientIds: Set<string>;
  disconnectTimer?: NodeJS.Timeout; // Timer for grace period
}

export class EventBus {
  private clients: Map<string, SSEClient> = new Map();
  private playerConnections: Map<string, PlayerConnectionInfo> = new Map(); // playerId -> connection info
  private readonly OFFLINE_GRACE_PERIOD_MS = 10000; // 10 seconds grace period
  private fastify: FastifyInstance | null = null;

  /**
   * Initialize EventBus with Fastify instance
   */
  initialize(fastify: FastifyInstance): void {
    this.fastify = fastify;
    logger.info('EventBus initialized with Fastify instance');
  }

  /**
   * Register SSE client
   * Returns client ID
   */
  registerClient(
    reply: FastifyReply,
    roomId: string,
    roleId: string,
    playerId?: string,
    userId?: string
  ): string {
    const clientId = this.generateClientId(roomId, roleId, playerId);

    // Setup SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Store client
    const client: SSEClient = {
      reply,
      roomId,
      roleId,
      playerId,
      userId,
      connectedAt: new Date(),
    };

    this.clients.set(clientId, client);

    logger.info(
      { clientId, roomId, roleId, playerId, userId, totalClients: this.clients.size },
      'SSE client registered'
    );

    // Track player connection if playerId is provided
    if (playerId) {
      this.handlePlayerConnect(roomId, playerId, clientId);
    }

    // Setup cleanup on connection close
    reply.raw.on('close', () => {
      this.unregisterClient(clientId);
    });

    // Send initial connection message
    this.sendEvent(clientId, 'connected', { message: 'Connected to event stream' });

    return clientId;
  }

  /**
   * Unregister SSE client
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);

    if (client) {
      this.clients.delete(clientId);

      // Track player disconnection if playerId is provided
      if (client.playerId) {
        this.handlePlayerDisconnect(client.roomId, client.playerId, clientId);
      }

      logger.info(
        {
          clientId,
          roomId: client.roomId,
          roleId: client.roleId,
          totalClients: this.clients.size,
        },
        'SSE client unregistered'
      );
    }
  }

  /**
   * Send event to specific client
   */
  sendEvent(clientId: string, eventType: string, data: any): boolean {
    const client = this.clients.get(clientId);

    if (!client) {
      logger.debug({ clientId, eventType }, 'Client not found, skipping event');
      return false;
    }

    try {
      const payload = JSON.stringify(data);
      client.reply.raw.write(`event: ${eventType}\n`);
      client.reply.raw.write(`data: ${payload}\n\n`);

      logger.debug({ clientId, eventType }, 'Event sent to client');
      return true;
    } catch (error) {
      logger.error({ error, clientId, eventType }, 'Failed to send event to client');
      this.unregisterClient(clientId);
      return false;
    }
  }

  /**
   * Broadcast perspective update to role
   */
  broadcastPerspective(
    roomId: string,
    roleId: string,
    perspective: RolePerspective
  ): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.roomId === roomId && client.roleId === roleId) {
        const success = this.sendEvent(clientId, 'perspective', perspective);
        if (success) {
          sentCount++;
        }
      }
    }

    logger.debug(
      { roomId, roleId, sentCount },
      'Perspective broadcasted to role clients'
    );

    return sentCount;
  }

  /**
   * Broadcast to all clients in a room
   */
  broadcastToRoom(roomId: string, eventType: string, data: any): number {
    let sentCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      if (client.roomId === roomId) {
        const success = this.sendEvent(clientId, eventType, data);
        if (success) {
          sentCount++;
        }
      }
    }

    logger.debug({ roomId, eventType, sentCount }, 'Event broadcasted to room');

    return sentCount;
  }

  /**
   * Send keepalive ping to all clients
   */
  sendKeepalive(): void {
    let activeCount = 0;

    for (const [clientId, client] of this.clients.entries()) {
      try {
        client.reply.raw.write(': keepalive\n\n');
        activeCount++;
      } catch (error) {
        logger.warn({ clientId, error }, 'Keepalive failed, removing client');
        this.unregisterClient(clientId);
      }
    }

    logger.debug({ activeCount, totalClients: this.clients.size }, 'Keepalive sent');
  }

  /**
   * Get connected clients for a room
   */
  getClientsForRoom(roomId: string): SSEClient[] {
    const clients: SSEClient[] = [];

    for (const client of this.clients.values()) {
      if (client.roomId === roomId) {
        clients.push(client);
      }
    }

    return clients;
  }

  /**
   * Get total client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalClients: number;
    roomCounts: Record<string, number>;
  } {
    const roomCounts: Record<string, number> = {};

    for (const client of this.clients.values()) {
      roomCounts[client.roomId] = (roomCounts[client.roomId] || 0) + 1;
    }

    return {
      totalClients: this.clients.size,
      roomCounts,
    };
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(roomId: string, roleId: string, playerId?: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return `${roomId}:${roleId}:${playerId || 'anon'}:${timestamp}:${random}`;
  }

  /**
   * Start keepalive timer
   */
  startKeepaliveTimer(intervalMs: number = 30000): NodeJS.Timeout {
    logger.info({ intervalMs }, 'Starting keepalive timer');

    return setInterval(() => {
      this.sendKeepalive();
    }, intervalMs);
  }

  /**
   * Handle player connection
   */
  private handlePlayerConnect(roomId: string, playerId: string, clientId: string): void {
    let connInfo = this.playerConnections.get(playerId);

    if (!connInfo) {
      // First connection for this player
      connInfo = {
        roomId,
        clientIds: new Set([clientId]),
      };
      this.playerConnections.set(playerId, connInfo);

      // Player is coming online
      this.setPlayerOnline(roomId, playerId);
    } else {
      // Player reconnecting or has multiple tabs
      connInfo.clientIds.add(clientId);

      // Cancel offline timer if exists (player reconnected within grace period)
      if (connInfo.disconnectTimer) {
        clearTimeout(connInfo.disconnectTimer);
        connInfo.disconnectTimer = undefined;
        logger.info({ roomId, playerId }, 'Player reconnected within grace period');
      }
    }
  }

  /**
   * Handle player disconnection
   */
  private handlePlayerDisconnect(roomId: string, playerId: string, clientId: string): void {
    const connInfo = this.playerConnections.get(playerId);

    if (!connInfo) {
      return;
    }

    // Remove this client from the set
    connInfo.clientIds.delete(clientId);

    // If no more connections, start grace period timer
    if (connInfo.clientIds.size === 0) {
      logger.info(
        { roomId, playerId, gracePeriodMs: this.OFFLINE_GRACE_PERIOD_MS },
        'All player connections closed, starting grace period'
      );

      connInfo.disconnectTimer = setTimeout(() => {
        // Grace period expired, mark player as offline
        this.playerConnections.delete(playerId);
        this.setPlayerOffline(roomId, playerId);
      }, this.OFFLINE_GRACE_PERIOD_MS);
    }
  }

  /**
   * Set player status to online
   */
  private async setPlayerOnline(roomId: string, playerId: string): Promise<void> {
    try {
      if (!this.fastify) {
        logger.error('EventBus not initialized with Fastify instance');
        return;
      }

      // Import dynamically to avoid circular dependency
      const { createStateManager } = await import('./state-manager.js');
      const stateManager = createStateManager(this.fastify);

      await stateManager.updatePlayerStatus(roomId, playerId, 'online');

      // Broadcast player status change
      this.broadcastToRoom(roomId, 'player_status_changed', {
        player_id: playerId,
        status: 'online',
        timestamp: new Date().toISOString(),
      });

      logger.info({ roomId, playerId }, 'Player status set to online');
    } catch (error) {
      logger.error({ error, roomId, playerId }, 'Failed to set player online');
    }
  }

  /**
   * Set player status to offline
   */
  private async setPlayerOffline(roomId: string, playerId: string): Promise<void> {
    try {
      if (!this.fastify) {
        logger.error('EventBus not initialized with Fastify instance');
        return;
      }

      // Import dynamically to avoid circular dependency
      const { createStateManager } = await import('./state-manager.js');
      const stateManager = createStateManager(this.fastify);

      await stateManager.updatePlayerStatus(roomId, playerId, 'offline');

      // Broadcast player status change
      this.broadcastToRoom(roomId, 'player_status_changed', {
        player_id: playerId,
        status: 'offline',
        timestamp: new Date().toISOString(),
      });

      logger.info({ roomId, playerId }, 'Player status set to offline');
    } catch (error) {
      logger.error({ error, roomId, playerId }, 'Failed to set player offline');
    }
  }

  /**
   * Check if player is online
   */
  isPlayerOnline(playerId: string): boolean {
    const connInfo = this.playerConnections.get(playerId);
    return connInfo !== undefined && connInfo.clientIds.size > 0;
  }

  /**
   * Get online players in a room
   */
  getOnlinePlayersInRoom(roomId: string): string[] {
    const onlinePlayers: string[] = [];

    for (const [playerId, connInfo] of this.playerConnections.entries()) {
      if (connInfo.roomId === roomId && connInfo.clientIds.size > 0) {
        onlinePlayers.push(playerId);
      }
    }

    return onlinePlayers;
  }
}

/**
 * Singleton instance
 */
let eventBusInstance: EventBus | null = null;

/**
 * Get or create EventBus singleton
 */
export function getEventBus(): EventBus {
  if (!eventBusInstance) {
    eventBusInstance = new EventBus();
  }
  return eventBusInstance;
}

