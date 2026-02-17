import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GameDO } from './game-do';
import { verifyJwt } from './jwt';
import type { Env } from './types';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// ==========================================
// 1. Admin API (Called by Business Backend)
// ==========================================

/**
 * POST /api/engine/create
 * Create or re-initialize a room DO.
 * Body: { roomId, ownerId, gameWorkerUrl?, config?, context? }
 */
app.post('/api/engine/create', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${c.env.ADMIN_SECRET}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<{
        roomId: string;
        ownerId: string;
        gameWorkerUrl?: string;
        config?: any;
        context?: any;
    }>();

    const roomId = body.roomId;
    if (!roomId) {
        return c.json({ error: 'roomId is required' }, 400);
    }

    const id = c.env.GAME_DO.idFromName(roomId);
    const stub = c.env.GAME_DO.get(id);

    // Initialize the DO with owner and optional game config
    const res = await stub.fetch('http://do/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            roomId: body.roomId,
            ownerId: body.ownerId,
            gameWorkerUrl: body.gameWorkerUrl,
            config: body.config,
            context: body.context,
        })
    });

    if (!res.ok) {
        const err = await res.json() as any;
        return c.json({ error: err.error || 'Failed to initialize room' }, 500);
    }

    return c.json({
        roomId,
        connectUrl: `${new URL(c.req.url).origin}/connect/${roomId}`
    });
});

// ==========================================
// 2. Client API (Called by Frontend)
// ==========================================

/**
 * GET /connect/:roomId?token=<JWT>
 * WebSocket upgrade endpoint. Verifies JWT, extracts userId/displayName,
 * then forwards to DO's /websocket handler.
 */
app.get('/connect/:roomId', async (c) => {
    const roomId = c.req.param('roomId');
    const token = c.req.query('token');

    if (!token) {
        return c.text('Missing token', 401);
    }

    // Verify JWT
    let payload;
    try {
        payload = await verifyJwt(token, c.env.JWT_SECRET);
    } catch (e: any) {
        console.error('JWT verification failed:', e.message);
        return c.text(`Authentication failed: ${e.message}`, 401);
    }

    // Verify roomId matches token
    if (payload.roomId !== roomId) {
        return c.text('Token roomId mismatch', 403);
    }

    const id = c.env.GAME_DO.idFromName(roomId);
    const stub = c.env.GAME_DO.get(id);

    // Forward to DO with verified user info
    const url = new URL(c.req.url);
    url.pathname = '/websocket';
    url.searchParams.set('userId', payload.sub);
    url.searchParams.set('displayName', payload.name);

    return stub.fetch(new Request(url, c.req.raw));
});

// ==========================================
// 3. Debug API
// ==========================================
app.get('/debug/:roomId', async (c) => {
    const roomId = c.req.param('roomId');
    const id = c.env.GAME_DO.idFromName(roomId);
    const stub = c.env.GAME_DO.get(id);
    return stub.fetch('http://do/debug');
});

export default app;
export { GameDO };
