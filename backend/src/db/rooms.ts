import { FastifyInstance } from 'fastify';
import { generateRoomId } from '../utils/room-id-generator';
import logger from '../utils/logger';

/**
 * Room Data Access Object
 * Handles all database operations for rooms table
 */

export interface Room {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: 'open' | 'playing' | 'paused' | 'finished';
  created_at: Date;
  updated_at: Date;
}

export class RoomDAO {
  constructor(private fastify: FastifyInstance) {}

  /**
   * Get room by ID
   */
  async getById(roomId: string): Promise<Room | null> {
    try {
      const result = await this.fastify.pg.query<Room>(
        'SELECT * FROM rooms WHERE room_id = $1',
        [roomId]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to get room by ID');
      throw error;
    }
  }

  /**
   * Get room by owner UID
   */
  async getByOwnerUid(ownerUid: string): Promise<Room | null> {
    try {
      const result = await this.fastify.pg.query<Room>(
        'SELECT * FROM rooms WHERE owner_uid = $1',
        [ownerUid]
      );
      return result.rows[0] || null;
    } catch (error) {
      logger.error({ error, ownerUid }, 'Failed to get room by owner UID');
      throw error;
    }
  }

  /**
   * Create a new room
   * Returns the room ID if successful
   */
  async create(ownerUid: string): Promise<string> {
    const roomId = generateRoomId();
    
    try {
      await this.fastify.pg.query(
        `INSERT INTO rooms (room_id, owner_uid, room_status)
         VALUES ($1, $2, 'open')`,
        [roomId, ownerUid]
      );
      
      logger.info({ roomId, ownerUid }, 'Room created');
      return roomId;
    } catch (error: any) {
      // Handle unique constraint violation (owner already has a room)
      if (error.code === '23505' && error.constraint === 'unique_owner_room') {
        logger.warn({ ownerUid }, 'Owner already has a room');
        throw new Error('OWNER_ALREADY_HAS_ROOM');
      }
      
      logger.error({ error, roomId, ownerUid }, 'Failed to create room');
      throw error;
    }
  }

  /**
   * Update room game ID
   */
  async updateGameId(roomId: string, gameId: string | null): Promise<void> {
    try {
      await this.fastify.pg.query(
        'UPDATE rooms SET game_id = $1 WHERE room_id = $2',
        [gameId, roomId]
      );
      logger.debug({ roomId, gameId }, 'Room game ID updated');
    } catch (error) {
      logger.error({ error, roomId, gameId }, 'Failed to update room game ID');
      throw error;
    }
  }

  /**
   * Update room status
   */
  async updateStatus(
    roomId: string,
    status: 'open' | 'playing' | 'paused' | 'finished'
  ): Promise<void> {
    try {
      await this.fastify.pg.query(
        'UPDATE rooms SET room_status = $1 WHERE room_id = $2',
        [status, roomId]
      );
      logger.debug({ roomId, status }, 'Room status updated');
    } catch (error) {
      logger.error({ error, roomId, status }, 'Failed to update room status');
      throw error;
    }
  }

  /**
   * Delete room
   */
  async delete(roomId: string): Promise<void> {
    try {
      await this.fastify.pg.query('DELETE FROM rooms WHERE room_id = $1', [
        roomId,
      ]);
      logger.info({ roomId }, 'Room deleted');
    } catch (error) {
      logger.error({ error, roomId }, 'Failed to delete room');
      throw error;
    }
  }

  /**
   * Get or create room for owner
   * Returns existing room if owner already has one, otherwise creates new
   */
  async getOrCreate(ownerUid: string): Promise<Room> {
    try {
      // Try to get existing room
      let room = await this.getByOwnerUid(ownerUid);
      
      if (room) {
        logger.debug({ roomId: room.room_id, ownerUid }, 'Found existing room');
        return room;
      }
      
      // Create new room
      const roomId = await this.create(ownerUid);
      room = await this.getById(roomId);
      
      if (!room) {
        throw new Error('Failed to retrieve newly created room');
      }
      
      return room;
    } catch (error) {
      logger.error({ error, ownerUid }, 'Failed to get or create room');
      throw error;
    }
  }
}

/**
 * Factory function to create RoomDAO instance
 */
export function createRoomDAO(fastify: FastifyInstance): RoomDAO {
  return new RoomDAO(fastify);
}

