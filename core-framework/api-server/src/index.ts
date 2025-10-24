/**
 * @nexus/api-server
 * 
 * API & WebSocket服务器入口
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import {
  createAuthService,
  createRoomManager,
  createDatabaseService,
} from '@nexus/platform-core';
import type { LLMAdapter } from '@nexus/platform-core/llm-adapter';
import { createHealthRouter, createRoomsRouter, createGamesRouter } from './routes';
import { setupWebSocketHandlers } from './websocket';

// 加载环境变量
dotenv.config();

// 创建Express应用
const app: express.Application = express();
const httpServer = createServer(app);

// 创建Socket.IO服务器
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// 中间件
app.use(cors());
app.use(express.json());

// 初始化服务
const authService = createAuthService({
  authServiceUrl: process.env.VITE_AUTH_API_BASE_URL || 'http://localhost/api',
  clientId: process.env.VITE_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
});

const roomManager = createRoomManager();

// LLM Adapter（可选，避免在没有SDK时崩溃）
let llmAdapter: LLMAdapter | null = null;
try {
  if (process.env.VITE_LLMAPI_BASE_URL) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createLLMAdapter } = require('@nexus/platform-core/llm-adapter');
    llmAdapter = createLLMAdapter({
      baseUrl: process.env.VITE_LLMAPI_BASE_URL,
      auth: authService.getAuthBridge(),
    });
  }
} catch (e) {
  console.warn('[API] LLM adapter disabled:', e instanceof Error ? e.message : e);
  llmAdapter = null;
}

// 数据库（可选）
let dbService: any = null;
if (process.env.DATABASE_URL) {
  dbService = createDatabaseService({
    connectionString: process.env.DATABASE_URL,
  });
}

// 认证中间件
const authMiddleware = authService.createAuthMiddleware();

// 注册路由
app.use(createHealthRouter());
app.use(createRoomsRouter(roomManager, authMiddleware));
app.use(createGamesRouter(authMiddleware));

// 根路由
app.get('/api', (req, res) => {
  res.json({
    message: 'Nexus Playground API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      games: '/api/games',
      rooms: '/api/rooms',
    },
  });
});

// WebSocket处理
setupWebSocketHandlers(io, {
  authService,
  roomManager,
  llmAdapter,
});

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[API] Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 启动服务器
const PORT = process.env.API_SERVER_PORT || 4000;
const HOST = process.env.API_SERVER_HOST || '0.0.0.0';

httpServer.listen(Number(PORT), HOST, () => {
  console.log(`🚀 API Server running at http://${HOST}:${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`📊 Database: ${dbService ? 'Connected' : 'Disabled'}`);
  console.log(`🤖 LLM API: ${llmAdapter ? 'Enabled' : 'Disabled'}`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing gracefully...');
  httpServer.close(async () => {
    if (dbService) {
      await dbService.close();
    }
    console.log('Server closed');
    process.exit(0);
  });
});

export { app, httpServer, io };

