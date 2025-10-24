/**
 * RoomModel - 房间数据模型（可选，房间通常保存在内存中）
 */

import { DatabaseService } from '../DatabaseService';

export interface RoomRecord {
  id: string;
  game_config_id: string;
  name: string;
  status: string;
  is_private: boolean;
  max_players: number;
  created_by: string;
  created_at: Date;
  metadata?: any;
}

/**
 * 房间模型（用于持久化历史房间记录）
 */
export class RoomModel {
  constructor(private db: DatabaseService) {}

  /**
   * 创建房间记录
   */
  async create(room: {
    id: string;
    game_config_id: string;
    name: string;
    status: string;
    is_private: boolean;
    max_players: number;
    created_by: string;
    metadata?: any;
  }): Promise<RoomRecord> {
    const query = `
      INSERT INTO rooms (
        id, game_config_id, name, status, is_private, max_players, created_by, created_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
      RETURNING *
    `;

    const result = await this.db.query<RoomRecord>(query, [
      room.id,
      room.game_config_id,
      room.name,
      room.status,
      room.is_private,
      room.max_players,
      room.created_by,
      room.metadata ? JSON.stringify(room.metadata) : null,
    ]);

    return result.rows[0];
  }

  /**
   * 根据ID查询房间
   */
  async findById(id: string): Promise<RoomRecord | null> {
    const query = 'SELECT * FROM rooms WHERE id = $1';
    const result = await this.db.query<RoomRecord>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * 更新房间状态
   */
  async updateStatus(id: string, status: string): Promise<void> {
    const query = 'UPDATE rooms SET status = $1 WHERE id = $2';
    await this.db.query(query, [status, id]);
  }

  /**
   * 初始化表结构
   */
  async initTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR(255) PRIMARY KEY,
        game_config_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        is_private BOOLEAN NOT NULL DEFAULT FALSE,
        max_players INTEGER NOT NULL,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        metadata JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_rooms_game_config ON rooms(game_config_id);
      CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
      CREATE INDEX IF NOT EXISTS idx_rooms_created_by ON rooms(created_by);
    `;
    await this.db.query(query);
  }
}

