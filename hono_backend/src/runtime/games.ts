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

export function getWorkerUrls(env: Env): string[] {
  if (!env.WORKER_URL) return [];
  return env.WORKER_URL.split(',')
    .map(url => url.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export async function listGames(env: Env): Promise<GameMetadata[]> {
  const workerUrls = getWorkerUrls(env);

  const fetchPromises = workerUrls.map(async (url): Promise<GameMetadata | null> => {
    try {
      const response = await fetch(`${url}/metadata`);
      if (response.ok) {
        const metadata = await response.json<GameMetadata>();
        return { ...metadata, workerUrl: url };
      }
    } catch (e) {
      console.error(`Failed to fetch metadata from ${url}:`, e);
    }
    return null;
  });

  const results = await Promise.all(fetchPromises);
  return results.filter((game): game is GameMetadata => game !== null);
}
