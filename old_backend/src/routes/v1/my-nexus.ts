import type { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';
import { createRoomsRepo } from '../../db/rooms-repo.js';
import { createNexusEngineClient } from '../../runtime/nexus-engine-client.js';
import { validateClientId, ensureAuthenticated } from '../../middleware/guards.js';

export function registerV1MyNexusRoute(app: Hono<AppEnv>) {
  app.get('/api/v1/my-nexus', async (c) => {
    const clientErr = validateClientId(c);
    if (clientErr) return clientErr;

    const user = ensureAuthenticated(c);
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const roomsRepo = createRoomsRepo(c.env);
    const room = await roomsRepo.getOrCreate(user.userId, user.displayName);

    const engine = createNexusEngineClient(c.env);
    const roomMetaHookUrl = `${new URL(c.req.url).origin}/api/v1/rooms/${room.room_id}/hook`;
    try {
      await engine.createRoom({
        roomId: room.room_id,
        ownerId: user.userId,
        ownerDisplayName: user.displayName,
        roomMetaHookUrl,
      });
    } catch (e) {
      console.error('Failed to create room in Engine DO:', e);
      // Engine DO create endpoint is idempotent in current architecture.
      // Swallow errors here to preserve historical behavior of best-effort init.
    }

    const token = await engine.generateToken(room.room_id, user.userId, user.displayName);
    const wsUrl = engine.getConnectUrl(room.room_id);

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
}
