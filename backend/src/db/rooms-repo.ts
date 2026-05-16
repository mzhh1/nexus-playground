import type { Env } from '../types';
import { generateRoomId } from '../utils/room-id';

export type RoomStatus = 'lobby' | 'playing' | 'paused' | 'finished';

export interface Room {
  room_id: string;
  owner_uid: string;
  room_name: string;
  game_id: string | null;
  room_status: RoomStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

type RoomRow = {
  room_id: string;
  owner_uid: string;
  room_name: string;
  game_id: string | null;
  room_status: string;
  is_public: number;
  created_at: string;
  updated_at: string;
};

function mapRoomRow(row: RoomRow): Room {
  return {
    room_id: row.room_id,
    owner_uid: row.owner_uid,
    room_name: row.room_name,
    game_id: row.game_id,
    room_status: row.room_status as RoomStatus,
    is_public: row.is_public === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class RoomsRepo {
  constructor(private db: D1Database) { }

  async getById(roomId: string): Promise<Room | null> {
    const row = await this.db.prepare(
      `SELECT room_id, owner_uid, room_name, game_id, room_status, is_public, created_at, updated_at
       FROM rooms
       WHERE room_id = ?1`
    )
      .bind(roomId)
      .first<RoomRow>();

    return row ? mapRoomRow(row) : null;
  }

  async getByOwnerUid(ownerUid: string): Promise<Room | null> {
    const row = await this.db.prepare(
      `SELECT room_id, owner_uid, room_name, game_id, room_status, is_public, created_at, updated_at
       FROM rooms
       WHERE owner_uid = ?1`
    )
      .bind(ownerUid)
      .first<RoomRow>();

    return row ? mapRoomRow(row) : null;
  }

  async create(ownerUid: string, ownerDisplayName: string): Promise<Room> {
    const now = new Date().toISOString();
    const roomName = `${ownerDisplayName}的房间`;

    for (let attempt = 0; attempt < 5; attempt++) {
      const roomId = generateRoomId();
      const result = await this.db.prepare(
        `INSERT INTO rooms (room_id, owner_uid, room_name, game_id, room_status, is_public, created_at, updated_at)
         VALUES (?1, ?2, ?3, NULL, 'lobby', 1, ?4, ?5)
         ON CONFLICT(owner_uid) DO NOTHING`
      )
        .bind(roomId, ownerUid, roomName, now, now)
        .run();

      if (result.success && (result.meta.changes ?? 0) > 0) {
        const created = await this.getById(roomId);
        if (!created) {
          throw new Error('Room created but cannot be retrieved');
        }
        return created;
      }

      const existing = await this.getByOwnerUid(ownerUid);
      if (existing) {
        return existing;
      }
    }

    throw new Error('Failed to create room after retries');
  }

  async getOrCreate(ownerUid: string, ownerDisplayName: string): Promise<Room> {
    const existing = await this.getByOwnerUid(ownerUid);
    if (existing) {
      return existing;
    }
    return this.create(ownerUid, ownerDisplayName);
  }

  async updateGameId(roomId: string, gameId: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE rooms SET game_id = ?1, updated_at = ?2 WHERE room_id = ?3`
    )
      .bind(gameId, now, roomId)
      .run();
  }

  async updateStatus(roomId: string, status: RoomStatus): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE rooms SET room_status = ?1, updated_at = ?2 WHERE room_id = ?3`
    )
      .bind(status, now, roomId)
      .run();
  }

  async updateMeta(roomId: string, name: string, gameId: string | null, isPublic: boolean, status: RoomStatus): Promise<void> {
    const now = new Date().toISOString();
    await this.db.prepare(
      `UPDATE rooms SET room_name = ?1, game_id = ?2, is_public = ?3, room_status = ?4, updated_at = ?5 WHERE room_id = ?6`
    )
      .bind(name, gameId, isPublic ? 1 : 0, status, now, roomId)
      .run();
  }

  async listPublicRooms(limit: number = 50): Promise<Room[]> {
    const { results } = await this.db.prepare(
      `SELECT room_id, owner_uid, room_name, game_id, room_status, is_public, created_at, updated_at
       FROM rooms
       WHERE is_public = 1 AND room_status = 'lobby'
       ORDER BY created_at DESC
       LIMIT ?1`
    )
      .bind(limit)
      .all<RoomRow>();

    return results.map(mapRoomRow);
  }

  async getAllRooms(limit: number = 50, offset: number = 0): Promise<{ data: Room[]; total: number }> {
    const totalResult = await this.db.prepare(`SELECT COUNT(*) as count FROM rooms`).first<{ count: number }>();
    const total = totalResult?.count || 0;

    const { results } = await this.db.prepare(
      `SELECT room_id, owner_uid, room_name, game_id, room_status, is_public, created_at, updated_at
       FROM rooms
       ORDER BY created_at DESC
       LIMIT ?1 OFFSET ?2`
    )
      .bind(limit, offset)
      .all<RoomRow>();

    return {
      data: results.map(mapRoomRow),
      total,
    };
  }

  async deleteRoom(roomId: string): Promise<boolean> {
    const result = await this.db.prepare(`DELETE FROM rooms WHERE room_id = ?1`)
      .bind(roomId)
      .run();
    return result.success && (result.meta.changes ?? 0) > 0;
  }
}
