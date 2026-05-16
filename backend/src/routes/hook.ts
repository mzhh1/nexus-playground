import { Hono } from 'hono';
import { requireEngineJwt } from '../middleware/auth';
import { RoomsRepo, type RoomStatus } from '../db/rooms-repo';
import { isValidRoomId } from '../utils/room-id';
import type { Env, Variables } from '../types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.put('/api/v1/rooms/:roomId/hook', requireEngineJwt(), async (c) => {
  const roomId = c.req.param('roomId');
  if (!isValidRoomId(roomId)) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const body = await c.req.json<{ name: string; gameId?: string | null; isPublic: boolean; phase: RoomStatus }>();
  if (!body.name || typeof body.isPublic !== 'boolean' || !body.phase) {
    return c.json({ error: 'Bad Request' }, 400);
  }

  const repo = new RoomsRepo(c.env.DB);
  await repo.updateMeta(roomId, body.name, body.gameId ?? null, body.isPublic, body.phase);

  return c.json({ success: true });
});

export default app;
