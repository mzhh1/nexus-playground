import type { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';
import { createRoomsRepo } from '../../db/rooms-repo.js';
import { createNexusEngineClient } from '../../runtime/nexus-engine-client.js';
import { isValidRoomId } from '../../utils/room-id.js';
import { validateClientId, ensureAuthenticated } from '../../middleware/guards.js';

export function registerV1RoomsRoute(app: Hono<AppEnv>) {
  app.get('/api/v1/rooms/:roomId/engine-connection', async (c) => {
    const clientErr = validateClientId(c);
    if (clientErr) return clientErr;

    const user = ensureAuthenticated(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

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
}
