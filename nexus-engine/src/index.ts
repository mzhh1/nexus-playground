import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GameDO } from './game-do';

type Bindings = {
    GAME_DO: DurableObjectNamespace;
    ADMIN_SECRET: string;
    JWT_PUBLIC_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/*', cors());

// ==========================================
// 1. Admin API (Called by Business Backend)
// ==========================================

// Create a new game container
app.post('/api/engine/create', async (c) => {
    // Simple Admin Auth
    const authHeader = c.req.header('Authorization');
    if (authHeader !== `Bearer ${c.env.ADMIN_SECRET}`) {
        return c.json({ error: 'Unauthorized' }, 401);
    }

    const body = await c.req.json<{
        roomId?: string; // Optional custom ID
        gameWorkerUrl: string;
        config: any;
        context: any;
    }>();

    // Generate ID if not provided
    const roomId = body.roomId || c.env.GAME_DO.newUniqueId().toString();
    // Ensure we consistently use the name-based ID if roomId provided, or unique if not
    // Actually, keeping mapping simple: Use idFromName for deterministic IDs provided by backend
    const id = c.env.GAME_DO.idFromName(roomId);
    const stub = c.env.GAME_DO.get(id);

    // Initialize the DO
    const res = await stub.fetch('http://do/init', {
        method: 'POST',
        body: JSON.stringify({
            config: {
                gameWorkerUrl: body.gameWorkerUrl,
                ...body.config
            },
            context: body.context
        })
    });

    if (!res.ok) {
        return c.json({ error: 'Failed to initialize container' }, 500);
    }

    return c.json({
        roomId,
        connectUrl: `${new URL(c.req.url).origin}/connect/${roomId}`
    });
});

// ==========================================
// 2. Client API (Called by Frontend)
// ==========================================

// Connect to Game WebSocket
app.get('/connect/:roomId', async (c) => {
    const roomId = c.req.param('roomId');
    const token = c.req.query('token');

    if (!token) {
        return c.text('Missing token', 401);
    }

    // TODO: Verify JWT using c.env.JWT_PUBLIC_KEY
    // For prototype, we skip strict JWT verification or mock it
    // In production, we MUST verify signature

    // Decoding token payload (Mock for now)
    // Assuming token is "userId:role" for simple testing if not using real JWT library yet
    // OR actually try to verify if we have the library

    // Let's implement a dummy verify or simple decode for M0 speed
    // Ideally: const payload = await verify(token, c.env.JWT_PUBLIC_KEY);

    // Mock fallback: userId:role
    let userId = 'unknown';
    let role = 'observer';

    if (token.includes(':')) {
        [userId, role] = token.split(':');
    } else {
        // Decode JWT without verification (NOT SAFE FOR PROD)
        try {
            const parts = token.split('.');
            const payload = JSON.parse(atob(parts[1]));
            userId = payload.userId;
            role = payload.role;
        } catch (e) {
            console.error("Token parse error", e);
        }
    }

    const id = c.env.GAME_DO.idFromName(roomId); // Get DO by room ID
    const stub = c.env.GAME_DO.get(id);

    // Pass userId/role to DO
    const url = new URL(c.req.url);
    url.pathname = '/websocket';
    url.searchParams.set('userId', userId);
    url.searchParams.set('role', role);

    return stub.fetch(new Request(url, c.req.raw));
});

export default app;
export { GameDO };
