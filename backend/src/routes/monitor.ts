import { Hono } from 'hono';
import type { Env, Variables } from '../types';
import { parseConfig } from '../config/env';
import { RoomsRepo } from '../db/rooms-repo';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use('/*', async (c, next) => {
  const config = parseConfig(c.env);
  const authHeader = c.req.header('Authorization');
  if (authHeader !== `Bearer ${config.nexusEngineAdminSecret}`) {
    return c.json({ error: 'Unauthorized Backend Monitor Access' }, 401);
  }
  await next();
});

app.get('/', async (c) => {
  const limit = Number(c.req.query('limit')) || 50;
  const offset = Number(c.req.query('offset')) || 0;
  const repo = new RoomsRepo(c.env.DB);

  try {
    const result = await repo.getAllRooms(limit, offset);
    return c.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return c.json({ error: msg }, 500);
  }
});

app.delete('/:roomId', async (c) => {
  const roomId = c.req.param('roomId');
  if (!roomId) return c.json({ error: 'Room ID required' }, 400);

  const config = parseConfig(c.env);
  const repo = new RoomsRepo(c.env.DB);

  try {
    const deleted = await repo.deleteRoom(roomId);
    if (!deleted) {
      return c.json({ error: 'Room not found or could not be deleted' }, 404);
    }

    try {
      const engineUrl = new URL(`/api/engine/room/${roomId}`, config.nexusEngineUrl).toString();
      await fetch(engineUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${config.nexusEngineAdminSecret}`,
        },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[BackendMonitor] Failed to sync-delete engine room ${roomId}: ${msg}`);
    }

    return c.json({ success: true, deleted: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg);
    return c.json({ error: msg }, 500);
  }
});

export default app;
