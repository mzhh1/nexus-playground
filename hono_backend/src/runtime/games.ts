import type { Env } from '../config.js';

interface GameMetadata {
  id: string;
  name: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  workerUrl?: string;
  [key: string]: unknown;
}

export function getGomokuWorkerUrl(env: Env): string | undefined {
  return env.GOMOKU_WORKER_URL?.replace(/\/$/, '');
}

export async function listGames(env: Env): Promise<GameMetadata[]> {
  const games: GameMetadata[] = [];
  const gomokuWorkerUrl = getGomokuWorkerUrl(env);

  if (gomokuWorkerUrl) {
    try {
      const response = await fetch(`${gomokuWorkerUrl}/metadata`);
      if (response.ok) {
        const metadata = await response.json<GameMetadata>();
        games.push({ ...metadata, workerUrl: gomokuWorkerUrl });
      }
    } catch {}
  }

  return games;
}
