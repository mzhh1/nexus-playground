import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GameState, Action, InitContext } from '@nexus/game-sdk';
import logic from '../../logic/index';

type Bindings = {
    ASSETS: Fetcher;
    UI_BASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS
app.use('/*', cors());

// Special route for ui.js to ensure CORS headers
// We renamed public/ui.js to public/_ui.js so direct access is bypassed
// and we can serve it here with custom headers
app.get('/ui.js', async (c) => {
    const url = new URL(c.req.url);
    url.pathname = '/_ui.js';
    const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));

    // Create new response with CORS headers
    const newResponse = new Response(response.body, response);
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Content-Type', 'application/javascript');
    return newResponse;
});

// 1. Metadata Endpoint
app.get('/metadata', (c) => {
    const metadata = logic.getMetadata();
    const url = c.req.url;
    // Use configured UI_BASE_URL or fallback to request origin
    // Note: c.env.UI_BASE_URL might be provided by .dev.vars or environment
    const uiBaseUrl = c.env.UI_BASE_URL || new URL(url).origin;

    // Enhance metadata with UI URL
    return c.json({
        ...metadata,
        ui: {
            mode: 'url',
            url: `${uiBaseUrl}/ui.js`,
        },
    });
});

// 2. Init Endpoint
app.post('/init', async (c) => {
    const body = await c.req.json<InitContext>();
    try {
        const state = logic.initState(body);
        return c.json(state);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// 3. Legal Actions Endpoint
app.post('/legal-actions', async (c) => {
    const body = await c.req.json<{ state: GameState; roleId: string }>();
    try {
        const actions = logic.getLegalActions(body.state, body.roleId);
        return c.json(actions);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// 4. Act Endpoint
app.post('/act', async (c) => {
    const body = await c.req.json<{ state: GameState; action: Action }>();
    try {
        const result = logic.applyAction(body.state, body.action);
        return c.json(result);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// 5. Check Terminal Endpoint
app.post('/check-terminal', async (c) => {
    const body = await c.req.json<{ state: GameState }>();
    try {
        const isTerminal = logic.isTerminal(body.state);
        const winners = isTerminal ? logic.getWinners(body.state) : null;
        return c.json({ isTerminal, winners });
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

// 6. Perspective Endpoint
app.post('/perspective', async (c) => {
    const body = await c.req.json<{
        state: GameState;
        roleId: string;
        wholeHistory: any[];
        diffHistory: any[];
    }>();
    try {
        const perspective = logic.toRolePerspective(
            body.state,
            body.roleId,
            body.wholeHistory || [],
            body.diffHistory || []
        );
        return c.json(perspective);
    } catch (error: any) {
        return c.json({ error: error.message }, 400);
    }
});

export default app;
