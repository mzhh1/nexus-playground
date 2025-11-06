import { FastifyInstance } from 'fastify';
import logger from '../utils/logger.js';

/**
 * Snapshot Data Access Object
 * Handles all database operations for snapshots table
 */

export interface Snapshot {
  snapshot_id: string;
  room_id: string;
  game_id: string;
  game_state: any; // JSON object
  turn_number: number;
  description: string | null;
  created_at: Date;
  created_by: string;
}

export interface CreateSnapshotParams {
  room_id: string;
  game_id: string;
  game_state: any;
  turn_number: number;
  description?: string;
  created_by: string;
}

export class SnapshotDAO {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Create a new snapshot
   */
  async create(params: CreateSnapshotParams): Promise<string> {
    try {
      const result = await this.fastify.pg.query<{ snapshot_id: string }>(
        `INSERT INTO snapshots 
         (room_id, game_id, game_state, turn_number, description, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING snapshot_id`,
        [
          params.room_id,
          params.game_id,
          JSON.stringify(params.game_state),
          params.turn_number,
          params.description || null,
          params.created_by,
        ]
      );

      const snapshotId = result.rows[0].snapshot_id;
      logger.info({ snapshotId, roomId: params.room_id }, 'Snapshot created');
      return snapshotId;
    } catch (error) {
      logger.error({ error, params }, 'Failed to create snapshot');
      throw error;
    }
  }

  /**
   * Get snapshot by ID
   */
  async getById(snapshotId: string): Promise<Snapshot | null> {
    try {
      const result = await this.fastify.pg.query<Snapshot>(
        'SELECT * FROM snapshots WHERE snapshot_id = $1',
        [snapshotId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, snapshotId }, 'Failed to get snapshot by ID');
      throw error;
    }
  }

  /**
   * List snapshots for a room
   */
  async listByRoomId(
    roomId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Snapshot[]> {
    try {
      const result = await this.fastify.pg.query<Snapshot>(
        `SELECT * FROM snapshots 
         WHERE room_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        [roomId, limit, offset]
      );
      return result.rows;
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to list snapshots');
      throw error;
    }
  }

  /**
   * Delete snapshot by ID
   */
  async delete(snapshotId: string): Promise<void> {
    try {
      await this.fastify.pg.query('DELETE FROM snapshots WHERE snapshot_id = $1', [
        snapshotId,
      ]);
      logger.info({ snapshotId }, 'Snapshot deleted');
    } catch (error) {
      logger.error({ error, snapshotId }, 'Failed to delete snapshot');
      throw error;
    }
  }

  /**
   * Get latest snapshot for a room
   */
  async getLatest(roomId: string): Promise<Snapshot | null> {
    try {
      const result = await this.fastify.pg.query<Snapshot>(
        `SELECT * FROM snapshots 
         WHERE room_id = $1 
         ORDER BY created_at DESC 
         LIMIT 1`,
        [roomId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to get latest snapshot');
      throw error;
    }
  }
}

/**
 * Factory function to create SnapshotDAO instance
 */
export function createSnapshotDAO(fastify: FastifyInstance): SnapshotDAO {
  return new SnapshotDAO(fastify);
}

