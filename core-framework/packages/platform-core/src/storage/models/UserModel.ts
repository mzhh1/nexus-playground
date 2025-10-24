/**
 * UserModel - 用户数据模型
 */

import { Player } from '@nexus/shared-types';
import { DatabaseService } from '../DatabaseService';

export interface UserRecord {
  uid: string;
  nickname?: string;
  email?: string;
  avatar?: string;
  level?: number;
  points?: number;
  created_at: Date;
  last_login_at?: Date;
}

/**
 * 用户模型
 */
export class UserModel {
  constructor(private db: DatabaseService) {}

  /**
   * 创建用户
   */
  async create(user: Player): Promise<UserRecord> {
    const query = `
      INSERT INTO users (uid, nickname, email, avatar, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (uid) DO UPDATE SET
        nickname = EXCLUDED.nickname,
        email = EXCLUDED.email,
        avatar = EXCLUDED.avatar,
        last_login_at = NOW()
      RETURNING *
    `;

    const result = await this.db.query<UserRecord>(query, [
      user.uid,
      user.nickname,
      user.email,
      user.avatar,
    ]);

    return result.rows[0];
  }

  /**
   * 根据UID查询用户
   */
  async findByUid(uid: string): Promise<UserRecord | null> {
    const query = 'SELECT * FROM users WHERE uid = $1';
    const result = await this.db.query<UserRecord>(query, [uid]);
    return result.rows[0] || null;
  }

  /**
   * 更新用户信息
   */
  async update(uid: string, updates: Partial<Player>): Promise<UserRecord | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.nickname !== undefined) {
      fields.push(`nickname = $${paramIndex++}`);
      values.push(updates.nickname);
    }
    if (updates.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(updates.email);
    }
    if (updates.avatar !== undefined) {
      fields.push(`avatar = $${paramIndex++}`);
      values.push(updates.avatar);
    }

    if (fields.length === 0) {
      return this.findByUid(uid);
    }

    values.push(uid);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE uid = $${paramIndex}
      RETURNING *
    `;

    const result = await this.db.query<UserRecord>(query, values);
    return result.rows[0] || null;
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(uid: string): Promise<void> {
    const query = 'UPDATE users SET last_login_at = NOW() WHERE uid = $1';
    await this.db.query(query, [uid]);
  }

  /**
   * 删除用户
   */
  async delete(uid: string): Promise<boolean> {
    const query = 'DELETE FROM users WHERE uid = $1';
    const result = await this.db.query(query, [uid]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * 初始化表结构
   */
  async initTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS users (
        uid VARCHAR(255) PRIMARY KEY,
        nickname VARCHAR(255),
        email VARCHAR(255),
        avatar TEXT,
        level INTEGER DEFAULT 1,
        points INTEGER DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_login_at TIMESTAMP
      )
    `;
    await this.db.query(query);
  }
}

