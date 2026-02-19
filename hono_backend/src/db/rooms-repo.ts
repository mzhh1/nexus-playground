import type { Env } from '../config.js';
import { generateRoomId } from '../utils/room-id.js';

export type RoomStatus = 'open' | 'playing' | 'paused';

export interface Room {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: RoomStatus;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

type RoomRow = {
  room_id: string;
  owner_uid: string;
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
    game_id: row.game_id,
    room_status: row.room_status as RoomStatus,
    is_public: row.is_public === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class RoomsRepo {
  constructor(private env: Env) {}

  async getById(roomId: string): Promise<Room | null> {
    const row = await this.env.DB.prepare(
      `SELECT room_id, owner_uid, game_id, room_status, is_public, created_at, updated_at
       FROM rooms
       WHERE room_id = ?1`
    )
      .bind(roomId)
      .first<RoomRow>();

    return row ? mapRoomRow(row) : null;
  }

  async getByOwnerUid(ownerUid: string): Promise<Room | null> {
    const row = await this.env.DB.prepare(
      `SELECT room_id, owner_uid, game_id, room_status, is_public, created_at, updated_at
       FROM rooms
       WHERE owner_uid = ?1`
    )
      .bind(ownerUid)
      .first<RoomRow>();

    return row ? mapRoomRow(row) : null;
  }

  async create(ownerUid: string): Promise<Room> {
    const now = new Date().toISOString();

    for (let attempt = 0; attempt < 5; attempt++) {
      const roomId = generateRoomId();
      const result = await this.env.DB.prepare(
        `INSERT INTO rooms (room_id, owner_uid, game_id, room_status, is_public, created_at, updated_at)
         VALUES (?1, ?2, NULL, 'open', 1, ?3, ?4)
         ON CONFLICT(owner_uid) DO NOTHING`
      )
        .bind(roomId, ownerUid, now, now)
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

  async getOrCreate(ownerUid: string): Promise<Room> {
    const existing = await this.getByOwnerUid(ownerUid);
    if (existing) {
      return existing;
    }
    return this.create(ownerUid);
  }

  async updateGameId(roomId: string, gameId: string | null): Promise<void> {
    const now = new Date().toISOString();
    await this.env.DB.prepare(
      `UPDATE rooms SET game_id = ?1, updated_at = ?2 WHERE room_id = ?3`
    )
      .bind(gameId, now, roomId)
      .run();
  }

  async updateStatus(roomId: string, status: RoomStatus): Promise<void> {
    const now = new Date().toISOString();
    await this.env.DB.prepare(
      `UPDATE rooms SET room_status = ?1, updated_at = ?2 WHERE room_id = ?3`
    )
      .bind(status, now, roomId)
      .run();
  }
}

export function createRoomsRepo(env: Env): RoomsRepo {
  return new RoomsRepo(env);
}
