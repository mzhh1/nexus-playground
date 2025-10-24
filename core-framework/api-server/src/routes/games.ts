/**
 * 游戏相关路由
 */

import { Router } from 'express';

export function createGamesRouter(authMiddleware: any) {
  const router = Router();

  // 获取游戏列表（硬编码的游戏配置，后续可以从数据库加载）
  router.get('/api/games', (req, res) => {
    const games = [
      {
        id: 'tic-tac-toe',
        name: 'Tic Tac Toe',
        description: 'Classic 3x3 Tic Tac Toe game',
        thumbnail: '/assets/tic-tac-toe.png',
        minPlayers: 2,
        maxPlayers: 2,
        tags: ['strategy', 'classic'],
        supportsAI: true,
        gameType: 'turn-based',
        informationType: 'perfect',
      },
    ];

    res.json({ games });
  });

  // 获取游戏详情
  router.get('/api/games/:gameId', (req, res) => {
    // 简化实现：返回井字棋配置
    if (req.params.gameId === 'tic-tac-toe') {
      res.json({
        id: 'tic-tac-toe',
        name: 'Tic Tac Toe',
        description: 'Classic 3x3 Tic Tac Toe game. Be the first to get 3 in a row!',
        rules: 'Players take turns placing X or O on a 3x3 grid. First to get 3 in a row wins.',
        minPlayers: 2,
        maxPlayers: 2,
        supportsAI: true,
        gameType: 'turn-based',
        informationType: 'perfect',
      });
    } else {
      res.status(404).json({ error: 'Game not found' });
    }
  });

  return router;
}

