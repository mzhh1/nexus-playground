/**
 * Game UI Loader
 * Dynamically loads game UI modules
 */

import type { GameUIComponent } from './game-ui-types';

// Game UI module registry - manually register game modules here
// This is necessary because Vite's glob imports need to be statically analyzable
// Note: In Docker, games directory is mounted at /app/games, so path is ../../games from src/lib/
const gameUIRegistry: Record<string, () => Promise<{ default: GameUIComponent }>> = {
  'tic-tac-toe': () => import('../../games/tic-tac-toe/ui/ui.tsx'),
  // Add more games here as they are created
  // 'game-id': () => import('../../games/game-id/ui/ui.tsx'),
};

/**
 * Load game UI component dynamically
 */
export async function loadGameUI(gameId: string): Promise<GameUIComponent | null> {
  try {
    // Check if the game is registered
    if (!(gameId in gameUIRegistry)) {
      console.error(`Game UI not registered for ${gameId}`);
      console.log('Available games:', Object.keys(gameUIRegistry));
      return null;
    }
    
    // Load the module
    const module = await gameUIRegistry[gameId]();
    
    // Return the default export (should be a React component)
    return module.default as GameUIComponent;
  } catch (error) {
    console.error(`Failed to load game UI for ${gameId}:`, error);
    return null;
  }
}

/**
 * Check if game UI exists
 */
export async function gameUIExists(gameId: string): Promise<boolean> {
  return gameId in gameUIRegistry;
}

/**
 * Preload game UI (for performance)
 */
export async function preloadGameUI(gameId: string): Promise<void> {
  try {
    if (gameId in gameUIRegistry) {
      await gameUIRegistry[gameId]();
    }
  } catch (error) {
    console.warn(`Failed to preload game UI for ${gameId}:`, error);
  }
}

/**
 * Get list of available game IDs
 */
export function getAvailableGameIds(): string[] {
  return Object.keys(gameUIRegistry);
}

