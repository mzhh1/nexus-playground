import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';
import { createRoomsRepo } from '../../db/rooms-repo.js';

export function registerMonitorBackendRoomRoute(app: Hono<AppEnv>) {
    const backendRoomApp = new Hono<AppEnv>();

    // Use Admin Secret to protect the backend endpoints
    backendRoomApp.use('/*', async (c, next) => {
        const authHeader = c.req.header('Authorization');
        if (authHeader !== `Bearer ${c.env.NEXUS_ENGINE_ADMIN_SECRET}`) {
            return c.json({ error: 'Unauthorized Backend Monitor Access' }, 401);
        }
        await next();
    });

    backendRoomApp.get('/', async (c) => {
        const limit = Number(c.req.query('limit')) || 50;
        const offset = Number(c.req.query('offset')) || 0;
        const roomsRepo = createRoomsRepo(c.env);

        try {
            const result = await roomsRepo.getAllRooms(limit, offset);
            return c.json(result);
        } catch (e: any) {
            console.error(e);
            return c.json({ error: e.message }, 500);
        }
    });

    backendRoomApp.delete('/:roomId', async (c) => {
        const roomId = c.req.param('roomId');
        if (!roomId) return c.json({ error: 'Room ID required' }, 400);

        const roomsRepo = createRoomsRepo(c.env);
        try {
            const deleted = await roomsRepo.deleteRoom(roomId);
            if (!deleted) {
                return c.json({ error: 'Room not found or could not be deleted' }, 404);
            }

            // Sync: try to delete corresponding Engine DO
            try {
                const engineUrl = new URL(`/api/engine/room/${roomId}`, c.env.NEXUS_ENGINE_URL).toString();
                await fetch(engineUrl, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${c.env.NEXUS_ENGINE_ADMIN_SECRET}`
                    }
                });
            } catch (err: any) {
                console.warn(`[BackendMonitor] Failed to sync-delete engine room ${roomId}: ${err.message}`);
                // Proceed with success anyway since the DB part is deleted
            }

            return c.json({ success: true, deleted: true });
        } catch (e: any) {
            console.error(e);
            return c.json({ error: e.message }, 500);
        }
    });

    app.route('/api/monitor/backendroom', backendRoomApp);
}
