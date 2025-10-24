/**
 * 健康检查路由
 */

import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  return router;
}

