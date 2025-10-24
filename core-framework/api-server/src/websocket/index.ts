/**
 * WebSocket处理器
 */

import { Server as SocketIOServer, Socket } from 'socket.io';
import type { AuthService, RoomManager } from '@nexus/platform-core';
import type { LLMAdapter } from '@nexus/platform-core/llm-adapter';

export interface WebSocketHandlerOptions {
  authService: AuthService;
  roomManager: RoomManager;
  llmAdapter: LLMAdapter | null;
}

export function setupWebSocketHandlers(
  io: SocketIOServer,
  options: WebSocketHandlerOptions
) {
  const { authService, roomManager, llmAdapter } = options;

  // 连接认证中间件
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const payload = await authService.verifyToken(token);
      if (!payload) {
        return next(new Error('Authentication error: Invalid token'));
      }

      // 附加用户信息到socket
      (socket as any).user = {
        uid: payload.sub,
        email: payload.email,
        nickname: payload.nickname,
      };

      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`[WS] User connected: ${user.uid} (${socket.id})`);

    // 加入房间
    socket.on('room:join', (data: { roomId: string; roleId: string }) => {
      const { roomId } = data;

      socket.join(roomId);
      console.log(`[WS] User ${user.uid} joined room ${roomId}`);

      // 发送当前房间状态
      const room = roomManager.getRoom(roomId);
      if (room) {
        socket.emit('room:joined', {
          room: room.toJSON(),
        });
      }
    });

    // 离开房间
    socket.on('room:leave', (data: { roomId: string }) => {
      const { roomId } = data;

      socket.leave(roomId);
      console.log(`[WS] User ${user.uid} left room ${roomId}`);
    });

    // 玩家行动
    socket.on('game:action', async (data: { roomId: string; action: any }) => {
      try {
        const { roomId, action } = data;
        const room = roomManager.getRoom(roomId);

        if (!room) {
          socket.emit('game:error', { error: 'Room not found' });
          return;
        }

        const gameInstance = room.getGameInstance();
        if (!gameInstance) {
          socket.emit('game:error', { error: 'Game not started' });
          return;
        }

        // 这里简化处理，实际应该使用GameLoop的executeAction方法
        // const result = await gameInstance.executeAction(action);

        // 广播状态更新到房间内所有玩家
        io.to(roomId).emit('game:state-update', {
          status: gameInstance.status,
          // perspective会根据不同玩家生成不同视角
        });
      } catch (error) {
        console.error('[WS] Action error:', error);
        socket.emit('game:error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    });

    // 玩家准备
    socket.on('room:ready', (data: { roomId: string; ready: boolean }) => {
      try {
        const { roomId, ready } = data;

        roomManager.setPlayerReady(roomId, user.uid, ready);

        const room = roomManager.getRoom(roomId);
        if (room) {
          // 广播房间状态更新
          io.to(roomId).emit('room:updated', {
            room: room.toJSON(),
          });

          // 如果所有玩家都准备好了，可以开始游戏
          if (room.areAllPlayersReady()) {
            io.to(roomId).emit('room:ready-to-start');
          }
        }
      } catch (error) {
        console.error('[WS] Ready error:', error);
        socket.emit('error', { message: 'Failed to set ready status' });
      }
    });

    // 断开连接
    socket.on('disconnect', () => {
      console.log(`[WS] User disconnected: ${user.uid} (${socket.id})`);

      // 可以在这里清理用户的房间状态
      // 例如：从所有房间中移除该用户
    });

    // 错误处理
    socket.on('error', (error) => {
      console.error(`[WS] Socket error for user ${user.uid}:`, error);
    });
  });

  console.log('[WS] WebSocket handlers initialized');
}

