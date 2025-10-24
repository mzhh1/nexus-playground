/**
 * DatabaseService - 数据库服务
 * 
 * 封装PostgreSQL操作，提供数据持久化功能
 */

import { Pool, PoolConfig, QueryResult, QueryResultRow, PoolClient } from 'pg';

export interface DatabaseConfig extends PoolConfig {
  // 扩展配置...
}

/**
 * 数据库服务
 */
export class DatabaseService {
  private pool: Pool;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool(config);

    // 监听错误
    this.pool.on('error', (err) => {
      console.error('[DatabaseService] Unexpected error:', err);
    });
  }

  /**
   * 执行查询
   */
  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      return await client.query<T>(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * 执行事务
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * 检查连接
   */
  async checkConnection(): Promise<boolean> {
    try {
      const result = await this.query('SELECT NOW()');
      return result.rows.length > 0;
    } catch (error) {
      console.error('[DatabaseService] Connection check failed:', error);
      return false;
    }
  }

  /**
   * 关闭连接池
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * 获取连接池统计
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }
}

/**
 * 创建数据库服务实例
 */
export function createDatabaseService(config: DatabaseConfig): DatabaseService {
  return new DatabaseService(config);
}

