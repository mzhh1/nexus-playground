import type { Hono } from 'hono';
import { jwtVerify } from 'jose';
import type { AppEnv } from '../../middleware/auth.js';
import { createRoomsRepo, type RoomStatus } from '../../db/rooms-repo.js';
import { createNexusEngineClient } from '../../runtime/nexus-engine-client.js';
import { isValidRoomId } from '../../utils/room-id.js';
import { validateClientId, getUserOrGuest } from '../../middleware/guards.js';

export function registerV1RoomsRoute(app: Hono<AppEnv>) {
  app.get('/api/v1/rooms', async (c) => {
    const roomsRepo = createRoomsRepo(c.env);
    try {
      const publicRooms = await roomsRepo.listPublicRooms();
      return c.json({ rooms: publicRooms });
    } catch (e) {
      console.error('Failed to list public rooms:', e);
      return c.json({ error: 'Failed to list public rooms' }, 500);
    }
  });

  app.get('/api/v1/rooms/:roomId/engine-connection', async (c) => {
    const clientErr = validateClientId(c);
    if (clientErr) return clientErr;

    const user = getUserOrGuest(c);

    const roomId = c.req.param('roomId');
    if (!isValidRoomId(roomId)) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    const roomsRepo = createRoomsRepo(c.env);
    const room = await roomsRepo.getById(roomId);
    if (!room) {
      return c.json({ error: 'Room not found' }, 404);
    }

    const engine = createNexusEngineClient(c.env);
    const token = await engine.generateToken(roomId, user.userId, user.displayName);

    return c.json({
      url: engine.getConnectUrl(roomId),
      token,
    });
  });

  app.put('/api/v1/rooms/:roomId/hook', async (c) => {
    const roomId = c.req.param('roomId');
    if (!isValidRoomId(roomId)) {
      return c.json({ error: 'Invalid request' }, 400);
    }

    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    try {
      const secret = new TextEncoder().encode(c.env.NEXUS_ENGINE_JWT_SECRET);
      const { payload } = await jwtVerify<{ roomId: string }>(token, secret);
      if (payload.roomId !== roomId) {
        return c.json({ error: 'Room mismatch' }, 403);
      }
    } catch (e) {
      console.error('Invalid token for room hook:', e);
      return c.json({ error: 'Invalid token' }, 401);
    }

    const body = await c.req.json<{ name: string; gameId?: string | null; isPublic: boolean; phase: RoomStatus }>();
    if (!body.name || typeof body.isPublic !== 'boolean' || !body.phase) {
      return c.json({ error: 'Bad Request' }, 400);
    }
    const gameId = body.gameId || null;

    const roomsRepo = createRoomsRepo(c.env);
    await roomsRepo.updateMeta(roomId, body.name, gameId, body.isPublic, body.phase);

    return c.json({ success: true });
  });
}
