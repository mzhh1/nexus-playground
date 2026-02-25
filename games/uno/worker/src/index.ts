import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { GameState, Action, InitContext } from '@nexus/game-sdk';
import logic from '../../logic/index';

type AssetFetcher = { fetch: (request: Request) => Promise<Response> };

type Bindings = {
  ASSETS: AssetFetcher;
  UI_BASE_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const WORKER_VERIFY_SIGNATURE = 'NEXUS_GAME_WORKER_VERIFIED_V1';

app.use('/*', cors());

app.get('/game-ui.js', async (c) => {
  const url = new URL(c.req.url);
  url.pathname = '/_ui.js';
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'application/javascript');
  return newResponse;
});

app.get('/style.css', async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'text/css');
  return newResponse;
});

app.get('/game-ui.html', async (c) => {
  const url = new URL(c.req.url);
  const response = await c.env.ASSETS.fetch(new Request(url, c.req.raw));
  const newResponse = new Response(response.body, response);
  newResponse.headers.set('Access-Control-Allow-Origin', '*');
  newResponse.headers.set('Content-Type', 'text/html');
  return newResponse;
});

app.get('/metadata', (c) => {
  const metadata = logic.getMetadata();
  const uiBaseUrl = c.env.UI_BASE_URL || new URL(c.req.url).origin;
  return c.json({
    ...metadata,
    ui: {
      mode: 'url',
      url: `${uiBaseUrl}/game-ui.html`,
    },
  });
});

app.get('/__nexus_worker_verify', (c) => {
  return c.text(WORKER_VERIFY_SIGNATURE, 200, {
    'Content-Type': 'text/plain; charset=utf-8',
  });
});

app.post('/init', async (c) => {
  const body = await c.req.json<InitContext>();
  try {
    const state = logic.initState(body);
    return c.json(state);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/legal-actions', async (c) => {
  const body = await c.req.json<{ state: GameState; roleId: string }>();
  try {
    const actions = logic.getLegalActions(body.state, body.roleId);
    return c.json(actions);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/action', async (c) => {
  const body = await c.req.json<{ state: GameState; action: Action }>();
  try {
    const result = ('validateAndApply' in logic)
      ? (logic as any).validateAndApply(body.state, body.action)
      : logic.applyAction(body.state, body.action);
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/is-terminal', async (c) => {
  const body = await c.req.json<{ state: GameState }>();
  try {
    const isTerminal = logic.isTerminal(body.state);
    const winners = isTerminal ? logic.getWinners(body.state) : null;
    return c.json({ isTerminal, winners });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

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

app.post('/state-prompt', async (c) => {
  const body = await c.req.json<{ perspective: any }>();
  try {
    let statePrompt: string | undefined;
    if (typeof logic.generateStatePrompt === 'function') {
      statePrompt = logic.generateStatePrompt(body.perspective);
    }
    return c.json({ statePrompt });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

app.post('/current-role', async (c) => {
  const body = await c.req.json<{ state: GameState }>();
  try {
    const roleId = logic.getCurrentRole(body.state);
    return c.json({ roleId });
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});

export default app;
