import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { parseConfig } from '../config/env';
import { listGames } from '../runtime/games';
import { RoomsRepo } from '../db/rooms-repo';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get('/', (c) => {
  return c.json({
    service: 'nexus-playground',
    status: 'running',
    message: 'Nexus Playground API — 公开接口无需认证',
  });
});

app.get('/health', async (c) => {
  const now = new Date().toISOString();
  let dbStatus: 'healthy' | 'unhealthy' = 'healthy';
  let status: 'healthy' | 'degraded' = 'healthy';

  try {
    await c.env.DB.prepare('SELECT 1').first();
  } catch {
    dbStatus = 'unhealthy';
    status = 'degraded';
  }

  return c.json(
    {
      status,
      timestamp: now,
      services: { d1: dbStatus },
    },
    status === 'healthy' ? 200 : 503
  );
});

app.get('/api/v1/games', async (c) => {
  const config = parseConfig(c.env);
  const games = await listGames(config.workerUrls);
  return c.json({ games });
});

app.get('/api/v1/rooms', async (c) => {
  const repo = new RoomsRepo(c.env.DB);
  try {
    const publicRooms = await repo.listPublicRooms();
    return c.json({ rooms: publicRooms });
  } catch (e) {
    console.error('Failed to list public rooms:', e);
    return c.json({ error: 'Failed to list public rooms' }, 500);
  }
});

export default app;
