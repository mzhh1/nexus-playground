export interface GameMetadata {
  id: string;
  name: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  workerUrl?: string;
  [key: string]: unknown;
}

export async function listGames(workerUrls: string[]): Promise<GameMetadata[]> {
  const fetchPromises = workerUrls.map(async (url): Promise<GameMetadata | null> => {
    try {
      const response = await fetch(`${url}/metadata`);
      if (response.ok) {
        const metadata = await response.json() as GameMetadata;
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
