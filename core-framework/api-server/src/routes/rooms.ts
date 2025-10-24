/**
 * 房间管理路由
 */

import { Router } from 'express';
import { RoomManager } from '@nexus/platform-core';

export function createRoomsRouter(roomManager: RoomManager, authMiddleware: any) {
  const router = Router();

  // 获取房间列表
  router.get('/api/rooms', (req, res) => {
    try {
      const { gameId, notFull, isPrivate } = req.query;

      const rooms = roomManager.findRooms({
        gameId: gameId as string,
        notFull: notFull === 'true',
        isPrivate: isPrivate === 'true' ? true : isPrivate === 'false' ? false : undefined,
      });

      res.json({
        rooms: rooms.map((r) => r.toJSON()),
      });
    } catch (error) {
      console.error('[API] Get rooms error:', error);
      res.status(500).json({ error: 'Failed to get rooms' });
    }
  });

  // 获取特定房间
  router.get('/api/rooms/:roomId', (req, res) => {
    try {
      const room = roomManager.getRoom(req.params.roomId);

      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json(room.toJSON());
    } catch (error) {
      console.error('[API] Get room error:', error);
      res.status(500).json({ error: 'Failed to get room' });
    }
  });

  // 创建房间（需要认证）
  router.post('/api/rooms', authMiddleware, (req, res) => {
    try {
      const { gameConfig, options } = req.body;
      const user = (req as any).user;

      if (!gameConfig) {
        return res.status(400).json({ error: 'gameConfig is required' });
      }

      const room = roomManager.createRoom(gameConfig, user.uid, options);

      // 创建者自动加入房间
      room.addPlayer({
        uid: user.uid,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
      });

      res.json(room.toJSON());
    } catch (error) {
      console.error('[API] Create room error:', error);
      res.status(500).json({ error: 'Failed to create room' });
    }
  });

  // 加入房间（需要认证）
  router.post('/api/rooms/:roomId/join', authMiddleware, (req, res) => {
    try {
      const { password } = req.body;
      const user = (req as any).user;

      const result = roomManager.joinRoom(req.params.roomId, {
        uid: user.uid,
        nickname: user.nickname,
        email: user.email,
        avatar: user.avatar,
      }, password);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json(result.room!.toJSON());
    } catch (error) {
      console.error('[API] Join room error:', error);
      res.status(500).json({ error: 'Failed to join room' });
    }
  });

  // 离开房间（需要认证）
  router.post('/api/rooms/:roomId/leave', authMiddleware, (req, res) => {
    try {
      const user = (req as any).user;

      const success = roomManager.leaveRoom(req.params.roomId, user.uid);

      if (!success) {
        return res.status(400).json({ error: 'Failed to leave room' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[API] Leave room error:', error);
      res.status(500).json({ error: 'Failed to leave room' });
    }
  });

  // 设置准备状态（需要认证）
  router.post('/api/rooms/:roomId/ready', authMiddleware, (req, res) => {
    try {
      const { ready } = req.body;
      const user = (req as any).user;

      const success = roomManager.setPlayerReady(req.params.roomId, user.uid, ready);

      if (!success) {
        return res.status(400).json({ error: 'Failed to set ready status' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[API] Set ready error:', error);
      res.status(500).json({ error: 'Failed to set ready status' });
    }
  });

  return router;
}

