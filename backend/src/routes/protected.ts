import { Hono } from 'hono';
import { requireAuth, withOptionalAuth, getUserOrGuest } from '../middleware/auth';
import { parseConfig } from '../config/env';
import { RoomsRepo } from '../db/rooms-repo';
import { NexusEngineClient } from '../runtime/nexus-engine-client';
import { isValidRoomId } from '../utils/room-id';
import type { Env, Variables } from '../types';

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.get('/api/me', requireAuth(), async (c) => {
  const user = c.get('user')!;
  return c.json({
    message: '您已成功认证',
    userId: user.sub,
    scopes: typeof user.scope === 'string' ? user.scope.split(' ') : [],
    tokenInfo: {
      issuer: user.iss,
      audience: user.aud,
      expiresAt: user.exp ? new Date(user.exp * 1000).toISOString() : null,
    },
  });
});

app.get('/api/v1/my-nexus', requireAuth({ scopes: ['access:playground'] }), async (c) => {
  const user = c.get('user')!;
  const config = parseConfig(c.env);
  const repo = new RoomsRepo(c.env.DB);
  const engineClient = new NexusEngineClient(config);

  const room = await repo.getOrCreate(user.sub, user.sub);

  const roomMetaHookUrl = `${new URL(c.req.url).origin}/api/v1/rooms/${room.room_id}/hook`;
  try {
    await engineClient.createRoom({
      roomId: room.room_id,
      ownerId: user.sub,
      ownerDisplayName: user.sub,
      roomMetaHookUrl,
    });
  } catch (e) {
    console.error('Failed to create room in Engine DO:', e);
  }

  const token = await engineClient.generateToken(room.room_id, user.sub, user.sub);
  const wsUrl = engineClient.getConnectUrl(room.room_id);

  return c.json({
    room_id: room.room_id,
    owner_uid: room.owner_uid,
    game_id: room.game_id,
    room_status: room.room_status,
    is_public: room.is_public,
    created_at: room.created_at,
    updated_at: room.updated_at,
    engine: {
      url: wsUrl,
      token,
    },
  });
});

app.get('/api/v1/rooms/:roomId/engine-connection', withOptionalAuth(), async (c) => {
  const { userId, displayName } = getUserOrGuest(c);
  const roomId = c.req.param('roomId');

  if (!isValidRoomId(roomId)) {
    return c.json({ error: 'Invalid request' }, 400);
  }

  const config = parseConfig(c.env);
  const repo = new RoomsRepo(c.env.DB);
  const room = await repo.getById(roomId);
  if (!room) {
    return c.json({ error: 'Room not found' }, 404);
  }

  const engineClient = new NexusEngineClient(config);
  const token = await engineClient.generateToken(roomId, userId, displayName);

  return c.json({
    url: engineClient.getConnectUrl(roomId),
    token,
  });
});

export default app;
