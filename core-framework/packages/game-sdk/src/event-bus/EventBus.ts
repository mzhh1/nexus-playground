/**
 * EventBus - 事件总线系统
 * 
 * 提供发布/订阅模式的事件系统，用于游戏内模块间通信
 */

import { GameEvent } from '@nexus/shared-types';

export type EventHandler<T = any> = (event: T) => void | Promise<void>;
export type EventUnsubscribe = () => void;

export interface EventBusOptions {
  /** 是否启用事件日志 */
  enableLogging?: boolean;
  
  /** 最大事件历史记录数 */
  maxEventHistory?: number;
  
  /** 是否异步执行事件处理器 */
  async?: boolean;
}

/**
 * 事件总线
 */
export class EventBus {
  private handlers: Map<string, Set<EventHandler>> = new Map();
  private eventHistory: GameEvent[] = [];
  private options: Required<EventBusOptions>;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      enableLogging: options.enableLogging ?? false,
      maxEventHistory: options.maxEventHistory ?? 1000,
      async: options.async ?? true,
    };
  }

  /**
   * 订阅事件
   */
  on(eventType: string, handler: EventHandler): EventUnsubscribe {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    this.handlers.get(eventType)!.add(handler);

    // 返回取消订阅函数
    return () => {
      this.off(eventType, handler);
    };
  }

  /**
   * 订阅一次性事件（触发后自动取消订阅）
   */
  once(eventType: string, handler: EventHandler): EventUnsubscribe {
    const wrappedHandler: EventHandler = async (event) => {
      this.off(eventType, wrappedHandler);
      await handler(event);
    };

    return this.on(eventType, wrappedHandler);
  }

  /**
   * 取消订阅
   */
  off(eventType: string, handler: EventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * 取消所有订阅
   */
  offAll(eventType?: string): void {
    if (eventType) {
      this.handlers.delete(eventType);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * 发布事件
   */
  async emit(eventType: string, data: any, triggeredBy?: string): Promise<void> {
    const event: GameEvent = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      triggeredBy,
    };

    // 记录事件历史
    this.recordEvent(event);

    // 日志输出
    if (this.options.enableLogging) {
      console.log(`[EventBus] ${eventType}:`, data);
    }

    // 获取事件处理器
    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // 执行所有处理器
    const promises: Promise<void>[] = [];
    for (const handler of handlers) {
      try {
        if (this.options.async) {
          promises.push(Promise.resolve(handler(event)));
        } else {
          await handler(event);
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${eventType}:`, error);
      }
    }

    // 等待所有异步处理器完成
    if (this.options.async && promises.length > 0) {
      await Promise.all(promises);
    }
  }

  /**
   * 同步发布事件（不等待处理器完成）
   */
  emitSync(eventType: string, data: any, triggeredBy?: string): void {
    const event: GameEvent = {
      type: eventType,
      data,
      timestamp: new Date().toISOString(),
      triggeredBy,
    };

    this.recordEvent(event);

    if (this.options.enableLogging) {
      console.log(`[EventBus] ${eventType}:`, data);
    }

    const handlers = this.handlers.get(eventType);
    if (!handlers || handlers.size === 0) {
      return;
    }

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${eventType}:`, error);
      }
    }
  }

  /**
   * 记录事件到历史
   */
  private recordEvent(event: GameEvent): void {
    this.eventHistory.push(event);

    // 限制历史记录大小
    if (this.eventHistory.length > this.options.maxEventHistory) {
      this.eventHistory.shift();
    }
  }

  /**
   * 获取事件历史
   */
  getEventHistory(eventType?: string, limit?: number): readonly GameEvent[] {
    let history = eventType
      ? this.eventHistory.filter((e) => e.type === eventType)
      : this.eventHistory;

    if (limit && limit > 0) {
      history = history.slice(-limit);
    }

    return [...history];
  }

  /**
   * 清空事件历史
   */
  clearEventHistory(): void {
    this.eventHistory = [];
  }

  /**
   * 获取所有已注册的事件类型
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * 检查是否有订阅者
   */
  hasListeners(eventType: string): boolean {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size > 0 : false;
  }

  /**
   * 获取订阅者数量
   */
  getListenerCount(eventType: string): number {
    const handlers = this.handlers.get(eventType);
    return handlers ? handlers.size : 0;
  }

  /**
   * 等待特定事件触发
   */
  waitFor(eventType: string, timeout?: number): Promise<GameEvent> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const unsubscribe = this.once(eventType, (event) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(event);
      });

      if (timeout && timeout > 0) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${eventType}`));
        }, timeout);
      }
    });
  }
}

