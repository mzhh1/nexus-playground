/**
 * Hook to fetch and cache games metadata
 */

import { useState, useEffect } from 'react';
import type { GameMetadata } from '../lib/types';

interface GamesMetadataResponse {
  games: GameMetadata[];
}

let cachedGames: GameMetadata[] | null = null;
let fetchPromise: Promise<GameMetadata[]> | null = null;
const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL;

async function fetchGamesMetadata(): Promise<GameMetadata[]> {
  // Return cached data if available
  if (cachedGames) {
    return cachedGames;
  }

  // If already fetching, return the existing promise
  if (fetchPromise) {
    return fetchPromise;
  }

  // Create new fetch promise
  fetchPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/games`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch games metadata: ${response.statusText}`);
      }

      const data: GamesMetadataResponse = await response.json();
      cachedGames = data.games;
      return cachedGames;
    } catch (error) {
      console.error('Error fetching games metadata:', error);
      throw error;
    } finally {
      fetchPromise = null;
    }
  })();

  return fetchPromise;
}

export function useGamesMetadata() {
  const [games, setGames] = useState<GameMetadata[]>(cachedGames || []);
  const [loading, setLoading] = useState(!cachedGames);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGamesMetadata()
      .then((data) => {
        setGames(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load games metadata');
        setLoading(false);
      });
  }, []);

  return { games, loading, error };
}

/**
 * Get game name by ID from cached metadata
 */
export function getGameName(gameId: string, games: GameMetadata[]): string | undefined {
  return games.find(game => game.id === gameId)?.name;
}

