/**
 * Perspective Generator
 * Generates role perspectives from game state with caching
 */

import { FastifyInstance } from 'fastify';
import { StateManager } from './state-manager.js';
import { getGameLogic } from '../games/registry.js';
import { RolePerspective, HistoryEvent } from '../games/types.js';
import logger from '../utils/logger.js';

export class PerspectiveGenerator {
  private readonly CACHE_TTL = 60; // 60 seconds
  private readonly CACHE_KEY_PREFIX = 'perspective:';

  constructor(
    private fastify: FastifyInstance,
    private stateManager: StateManager
  ) {}

  /**
   * Generate perspective for a role
   * Uses caching to avoid regenerating same perspective
   */
  async generatePerspective(
    roomId: string,
    roleId: string,
    options: { skipCache?: boolean } = {}
  ): Promise<RolePerspective | null> {
    try {
      // Check cache first (unless skipCache is true)
      if (!options.skipCache) {
        const cached = await this.getCachedPerspective(roomId, roleId);
        if (cached) {
          logger.debug({ roomId, roleId }, 'Perspective served from cache');
          return cached;
        }
      }

      // Get room state
      const roomState = await this.stateManager.getRoomState(roomId);

      if (!roomState) {
        logger.warn({ roomId, roleId }, 'Room not found when generating perspective');
        return null;
      }

      // Validate game is selected
      if (!roomState.game_id || !roomState.game_state) {
        logger.warn({ roomId, roleId }, 'Game not initialized when generating perspective');
        return null;
      }

      // Get game logic
      const gameLogic = getGameLogic(roomState.game_id);

      // Calculate differential history
      const diffHistory = this.calculateDiffHistory(roomState.history, roleId);

      // Generate perspective
      const perspective = gameLogic.toRolePerspective(
        roomState.game_state,
        roleId,
        roomState.history,
        diffHistory
      );

      // Cache perspective
      await this.cachePerspective(roomId, roleId, perspective);

      logger.debug({ roomId, roleId }, 'Perspective generated and cached');

      return perspective;
    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to generate perspective');
      throw error;
    }
  }

  /**
   * Generate perspectives for all roles in the room
   */
  async generateAllPerspectives(
    roomId: string
  ): Promise<Record<string, RolePerspective>> {
    try {
      const roomState = await this.stateManager.getRoomState(roomId);

      if (!roomState || !roomState.game_id || !roomState.game_state) {
        logger.warn({ roomId }, 'Cannot generate perspectives - game not initialized');
        return {};
      }

      const perspectives: Record<string, RolePerspective> = {};

      // Generate perspective for each mapped role
      for (const roleId of Object.keys(roomState.role_mapping)) {
        const perspective = await this.generatePerspective(roomId, roleId, {
          skipCache: true,
        });

        if (perspective) {
          perspectives[roleId] = perspective;
        }
      }

      logger.debug(
        { roomId, roleCount: Object.keys(perspectives).length },
        'All perspectives generated'
      );

      return perspectives;
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to generate all perspectives');
      throw error;
    }
  }

  /**
   * Invalidate cached perspective
   */
  async invalidatePerspective(roomId: string, roleId: string): Promise<void> {
    try {
      const key = this.getCacheKey(roomId, roleId);
      await this.fastify.redis.del(key);
      logger.debug({ roomId, roleId }, 'Perspective cache invalidated');
    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to invalidate perspective cache');
    }
  }

  /**
   * Invalidate all cached perspectives for a room
   */
  async invalidateAllPerspectives(roomId: string): Promise<void> {
    try {
      const pattern = `${this.CACHE_KEY_PREFIX}${roomId}:*`;
      const keys = await this.fastify.redis.keys(pattern);

      if (keys.length > 0) {
        await this.fastify.redis.del(...keys);
        logger.debug({ roomId, count: keys.length }, 'All perspective caches invalidated');
      }
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to invalidate all perspective caches');
    }
  }

  /**
   * Calculate differential history for a role
   * Returns events since role's last action (inclusive)
   */
  private calculateDiffHistory(
    fullHistory: HistoryEvent[],
    roleId: string
  ): HistoryEvent[] {
    // Find last action by this role
    const lastActionIndex = fullHistory.findLastIndex(
      (event) => event.role_id === roleId
    );

    // If role hasn't acted yet, return all history
    if (lastActionIndex === -1) {
      return [...fullHistory];
    }

    // Return events from last action (inclusive) to present
    return fullHistory.slice(lastActionIndex);
  }

  /**
   * Get cached perspective
   */
  private async getCachedPerspective(
    roomId: string,
    roleId: string
  ): Promise<RolePerspective | null> {
    try {
      const key = this.getCacheKey(roomId, roleId);
      const data = await this.fastify.redis.get(key);

      if (!data) {
        return null;
      }

      return JSON.parse(data) as RolePerspective;
    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to get cached perspective');
      return null;
    }
  }

  /**
   * Cache perspective
   */
  private async cachePerspective(
    roomId: string,
    roleId: string,
    perspective: RolePerspective
  ): Promise<void> {
    try {
      const key = this.getCacheKey(roomId, roleId);
      const data = JSON.stringify(perspective);

      await this.fastify.redis.setex(key, this.CACHE_TTL, data);
    } catch (error) {
      logger.error({ error, roomId, roleId }, 'Failed to cache perspective');
      // Don't throw - caching failure shouldn't break perspective generation
    }
  }

  /**
   * Get cache key for perspective
   */
  private getCacheKey(roomId: string, roleId: string): string {
    return `${this.CACHE_KEY_PREFIX}${roomId}:${roleId}`;
  }
}

/**
 * Factory function to create PerspectiveGenerator instance
 */
export function createPerspectiveGenerator(
  fastify: FastifyInstance,
  stateManager: StateManager
): PerspectiveGenerator {
  return new PerspectiveGenerator(fastify, stateManager);
}

