/**
 * WebSocketClient - WebSocket客户端封装
 */

import { io, Socket } from 'socket.io-client';

export interface WebSocketClientOptions {
  url: string;
  token?: string;
  reconnect?: boolean;
  reconnectDelay?: number;
}

type EventHandler = (...args: any[]) => void;

/**
 * WebSocket客户端
 */
export class WebSocketClient {
  private socket: Socket | null = null;
  private options: WebSocketClientOptions;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();

  constructor(options: WebSocketClientOptions) {
    this.options = options;
  }

  /**
   * 连接到服务器
   */
  connect(): void {
    if (this.socket) {
      return;
    }

    this.socket = io(this.options.url, {
      auth: {
        token: this.options.token,
      },
      reconnection: this.options.reconnect ?? true,
      reconnectionDelay: this.options.reconnectDelay ?? 3000,
    });

    this.socket.on('connect', () => {
      console.log('[WebSocketClient] Connected');
      this.trigger('connect');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocketClient] Disconnected:', reason);
      this.trigger('disconnect', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocketClient] Connection error:', error);
      this.trigger('error', error);
    });

    // 转发所有服务器事件
    this.socket.onAny((event, ...args) => {
      this.trigger(event, ...args);
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * 发送事件
   */
  emit(event: string, data: any): void {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }

    this.socket.emit(event, data);
  }

  /**
   * 监听事件
   */
  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }

    this.eventHandlers.get(event)!.add(handler);

    // 返回取消监听函数
    return () => {
      this.off(event, handler);
    };
  }

  /**
   * 取消监听
   */
  off(event: string, handler: EventHandler): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 触发事件处理器
   */
  private trigger(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`[WebSocketClient] Error in handler for ${event}:`, error);
        }
      }
    }
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  /**
   * 获取Socket实例（高级用法）
   */
  getSocket(): Socket | null {
    return this.socket;
  }
}

