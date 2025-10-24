/**
 * MatchmakingService - 匹配系统
 * 
 * 提供简单的匹配队列功能，将玩家匹配到合适的游戏房间
 */

import { Player, GameConfig } from '@nexus/shared-types';

export interface MatchmakingRequest {
  player: Player;
  gameId: string;
  preferredRoleId?: string;
  skillLevel?: number;
  metadata?: Record<string, any>;
}

export interface MatchmakingQueue {
  gameId: string;
  requests: MatchmakingRequest[];
  createdAt: string;
}

/**
 * 匹配服务
 */
export class MatchmakingService {
  private queues: Map<string, MatchmakingQueue> = new Map();
  private matchmakingInterval: NodeJS.Timeout | null = null;

  /**
   * 启动匹配服务
   */
  start(intervalMs: number = 5000): void {
    if (this.matchmakingInterval) {
      return;
    }

    this.matchmakingInterval = setInterval(() => {
      this.processQueues();
    }, intervalMs);

    console.log('[MatchmakingService] Started');
  }

  /**
   * 停止匹配服务
   */
  stop(): void {
    if (this.matchmakingInterval) {
      clearInterval(this.matchmakingInterval);
      this.matchmakingInterval = null;
      console.log('[MatchmakingService] Stopped');
    }
  }

  /**
   * 玩家加入匹配队列
   */
  joinQueue(request: MatchmakingRequest): void {
    const { gameId } = request;

    if (!this.queues.has(gameId)) {
      this.queues.set(gameId, {
        gameId,
        requests: [],
        createdAt: new Date().toISOString(),
      });
    }

    const queue = this.queues.get(gameId)!;

    // 检查玩家是否已在队列中
    const existingIndex = queue.requests.findIndex(
      (r) => r.player.uid === request.player.uid
    );

    if (existingIndex >= 0) {
      // 更新已有请求
      queue.requests[existingIndex] = request;
    } else {
      // 添加新请求
      queue.requests.push(request);
    }
  }

  /**
   * 玩家离开匹配队列
   */
  leaveQueue(gameId: string, uid: string): boolean {
    const queue = this.queues.get(gameId);
    if (!queue) {
      return false;
    }

    const index = queue.requests.findIndex((r) => r.player.uid === uid);
    if (index >= 0) {
      queue.requests.splice(index, 1);
      return true;
    }

    return false;
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(gameId: string): MatchmakingQueue | undefined {
    return this.queues.get(gameId);
  }

  /**
   * 获取所有队列
   */
  getAllQueues(): MatchmakingQueue[] {
    return Array.from(this.queues.values());
  }

  /**
   * 处理匹配队列（定期执行）
   */
  private processQueues(): void {
    for (const [gameId, queue] of this.queues.entries()) {
      if (queue.requests.length < 2) {
        continue; // 至少需要2个玩家
      }

      // 简单的先到先匹配策略
      // 实际应用中可以根据技能等级、延迟等进行更复杂的匹配
      const match = this.findMatch(queue);

      if (match) {
        // 触发匹配成功事件（由外部监听处理）
        this.onMatchFound(match);

        // 从队列中移除已匹配的玩家
        for (const request of match) {
          const index = queue.requests.findIndex(
            (r) => r.player.uid === request.player.uid
          );
          if (index >= 0) {
            queue.requests.splice(index, 1);
          }
        }
      }
    }
  }

  /**
   * 查找匹配（简单的FIFO策略）
   */
  private findMatch(
    queue: MatchmakingQueue
  ): MatchmakingRequest[] | null {
    // 简单实现：取前2个玩家
    // 实际应用中可以根据配置的最小/最大玩家数进行匹配
    if (queue.requests.length >= 2) {
      return queue.requests.slice(0, 2);
    }

    return null;
  }

  /**
   * 匹配成功回调（子类或外部可以重写）
   */
  protected onMatchFound(match: MatchmakingRequest[]): void {
    console.log(
      '[MatchmakingService] Match found:',
      match.map((r) => r.player.uid)
    );
    // 默认实现：只打印日志
    // 实际应用中应该创建房间并通知玩家
  }

  /**
   * 设置匹配成功处理器
   */
  onMatch(handler: (match: MatchmakingRequest[]) => void): void {
    this.onMatchFound = handler;
  }

  /**
   * 清理空队列
   */
  cleanup(): void {
    for (const [gameId, queue] of this.queues.entries()) {
      if (queue.requests.length === 0) {
        this.queues.delete(gameId);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    totalQueues: number;
    totalPlayersInQueue: number;
    queuesByGame: Record<string, number>;
  } {
    let totalPlayers = 0;
    const queuesByGame: Record<string, number> = {};

    for (const [gameId, queue] of this.queues.entries()) {
      totalPlayers += queue.requests.length;
      queuesByGame[gameId] = queue.requests.length;
    }

    return {
      totalQueues: this.queues.size,
      totalPlayersInQueue: totalPlayers,
      queuesByGame,
    };
  }
}

/**
 * 创建匹配服务实例
 */
export function createMatchmakingService(): MatchmakingService {
  return new MatchmakingService();
}

