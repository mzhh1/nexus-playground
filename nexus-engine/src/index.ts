import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { GameDO } from './game-do';
import { MonitorDO } from './monitor-do';
import { verifyJwt } from './jwt';
import type { Env } from './types';
import {
    getMonitorLogById,
    getMonitorLogsByGroup,
    listMonitorLogs,
    parseListParams,
} from './monitor-store';

const app = new Hono<{ Bindings: Env }>();

app.use('/*', cors());

// ==========================================
// 1. Admin API (Called by Business Backend)
// ==========================================

/**
 * POST /api/engine/create
 * Create or re-initialize a room DO.
 * Body: { roomId, ownerId }
 */
app.post('/api/engine/create', async (c) => {
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${c.env.ADMIN_SECRET}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<{
        roomId: string;
        ownerId: string;
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

function verifyAdmin(c: Context<{ Bindings: Env }>): boolean {
    const authHeader = c.req.header('Authorization');
    return authHeader === `Bearer ${c.env.ADMIN_SECRET}`;
}

// ==========================================
// 3. Monitor APIs (D1 + SSE)
// ==========================================
app.get('/api/monitor/logs', async (c) => {
    if (!verifyAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);

    const url = new URL(c.req.url);
    const params = parseListParams(url.searchParams);
    const result = await listMonitorLogs(c.env.DB, params);
    return c.json(result);
});

app.get('/api/monitor/logs/stream', async (c) => {
    if (!verifyAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);

    const roomId = c.req.query('roomId') || '';
    const id = c.env.MONITOR_DO.idFromName('global');
    const stub = c.env.MONITOR_DO.get(id);
    const doUrl = new URL('http://do/stream');
    doUrl.searchParams.set('roomId', roomId);

    const passthroughKeys = ['playerType', 'status', 'roleId', 'gameId', 'startDate', 'endDate'];
    for (const key of passthroughKeys) {
        const value = c.req.query(key);
        if (value) doUrl.searchParams.set(key, value);
    }

    const req = new Request(doUrl.toString(), {
        method: 'GET',
        headers: {
            'last-event-id': c.req.header('last-event-id') || '',
        },
    });
    return stub.fetch(req);
});

app.get('/api/monitor/logs/groups/:groupId', async (c) => {
    if (!verifyAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);

    const groupId = c.req.param('groupId');
    const data = await getMonitorLogsByGroup(c.env.DB, groupId);
    if (data.length === 0) {
        return c.json({ interaction_group_id: groupId, data: [] });
    }
    return c.json({ interaction_group_id: groupId, data });
});

app.get('/api/monitor/logs/:interactionId', async (c) => {
    if (!verifyAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);

    const interactionId = c.req.param('interactionId');
    const data = await getMonitorLogById(c.env.DB, interactionId);
    if (!data) return c.json({ error: 'Not found' }, 404);
    return c.json({ data });
});

app.get('/api/monitor/room/list', async (c) => {
    if (!verifyAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);

    const limit = parseInt(c.req.query('limit') || '100');
    const cursor = c.req.query('cursor');

    // @ts-ignore - list() is available on namespace but might not be in older types
    const result = await c.env.GAME_DO.list({ limit, cursor });

    return c.json({
        data: result.objects.map((obj: any) => ({
            id: obj.id.toString(),
            name: obj.name || '',
        })),
        cursor: result.cursor,
    });
});

app.get('/api/monitor/room/:id', async (c) => {
    if (!verifyAdmin(c)) return c.json({ error: 'Unauthorized' }, 401);

    const idParam = c.req.param('id');
    let id: any;
    try {
        if (idParam.length === 64) {
            id = c.env.GAME_DO.idFromString(idParam);
        } else {
            id = c.env.GAME_DO.idFromName(idParam);
        }
    } catch (e) {
        return c.json({ error: 'Invalid ID format' }, 400);
    }

    const stub = c.env.GAME_DO.get(id);
    const res = await stub.fetch('http://do/state');
    if (!res.ok) {
        return c.json({ error: 'Failed to fetch room state' }, res.status as any);
    }

    const state = await res.json();
    return c.json({ data: state });
});

// ==========================================
// 4. Debug API
// ==========================================
app.get('/debug/:roomId', async (c) => {
    const roomId = c.req.param('roomId');
    const id = c.env.GAME_DO.idFromName(roomId);
    const stub = c.env.GAME_DO.get(id);
    return stub.fetch('http://do/debug');
});

export default app;
export { GameDO };
export { MonitorDO };
