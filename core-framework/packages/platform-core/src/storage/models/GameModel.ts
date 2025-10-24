/**
 * GameModel - 游戏记录数据模型
 */

import { GameInstance } from '@nexus/shared-types';
import { DatabaseService } from '../DatabaseService';

export interface GameRecord {
  id: string;
  game_config_id: string;
  global_state: any;
  role_mapping: any;
  status: string;
  created_at: Date;
  updated_at: Date;
  ended_at?: Date;
  result?: any;
}

/**
 * 游戏记录模型
 */
export class GameModel {
  constructor(private db: DatabaseService) {}

  /**
   * 创建游戏记录
   */
  async create(instance: GameInstance): Promise<GameRecord> {
    const query = `
      INSERT INTO games (
        id, game_config_id, global_state, role_mapping, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await this.db.query<GameRecord>(query, [
      instance.instanceId,
      instance.config.id,
      JSON.stringify(instance.globalState),
      JSON.stringify(instance.roleMapping),
      instance.status,
      instance.createdAt,
      instance.updatedAt,
    ]);

    return result.rows[0];
  }

  /**
   * 根据ID查询游戏
   */
  async findById(id: string): Promise<GameRecord | null> {
    const query = 'SELECT * FROM games WHERE id = $1';
    const result = await this.db.query<GameRecord>(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * 更新游戏状态
   */
  async update(
    id: string,
    updates: {
      global_state?: any;
      status?: string;
      ended_at?: string;
      result?: any;
    }
  ): Promise<GameRecord | null> {
    const fields: string[] = ['updated_at = NOW()'];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.global_state !== undefined) {
      fields.push(`global_state = $${paramIndex++}`);
      values.push(JSON.stringify(updates.global_state));
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.ended_at !== undefined) {
      fields.push(`ended_at = $${paramIndex++}`);
      values.push(updates.ended_at);
    }
    if (updates.result !== undefined) {
      fields.push(`result = $${paramIndex++}`);
      values.push(JSON.stringify(updates.result));
    }

    values.push(id);
    const query = `
      UPDATE games
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query<GameRecord>(query, values);
    return result.rows[0] || null;
  }

  /**
   * 查询用户的游戏历史
   */
  async findByUser(uid: string, limit: number = 50): Promise<GameRecord[]> {
    const query = `
      SELECT * FROM games
      WHERE role_mapping::jsonb ? $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    const result = await this.db.query<GameRecord>(query, [uid, limit]);
    return result.rows;
  }

  /**
   * 初始化表结构
   */
  async initTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS games (
        id VARCHAR(255) PRIMARY KEY,
        game_config_id VARCHAR(255) NOT NULL,
        global_state JSONB NOT NULL,
        role_mapping JSONB NOT NULL,
        status VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        ended_at TIMESTAMP,
        result JSONB
      );
      CREATE INDEX IF NOT EXISTS idx_games_config_id ON games(game_config_id);
      CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
      CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
    `;
    await this.db.query(query);
  }
}

