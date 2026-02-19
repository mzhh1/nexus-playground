import type { Hono } from 'hono';
import type { AppEnv } from '../../middleware/auth.js';
import { listGames } from '../../runtime/games.js';

export function registerV1GamesRoute(app: Hono<AppEnv>) {
  app.get('/api/v1/games', async (c) => {
    const games = await listGames(c.env);
    return c.json({ games });
  });
}
