/**
 * Game UI Loader
 * Dynamically loads game UI modules
 */

import type { GameUIComponent } from './game-ui-types';

// Game UI module registry - manually register game modules here
// This is necessary because Vite's glob imports need to be statically analyzable
// Note: In Docker, games directory is mounted at /app/games, so path is ../../games from src/lib/
const gameUIRegistry: Record<string, () => Promise<{ default: GameUIComponent }>> = {
  // 'tic-tac-toe': () => import('../../games/tic-tac-toe/ui/ui.tsx'),
  // 'gomoku': () => import('../../games/gomoku/ui/ui.tsx'),
  // 'xiangqi': () => import('../../games/xiangqi/ui/ui.tsx'),
  // 'werewolf': () => import('../../games/werewolf/ui/ui.tsx'),
  // Games are temporarily disabled for Phase 1 Vercel deployment
};

/**
 * Load game UI component dynamically
 */
/**
 * Load game UI component dynamically
 */
export async function loadGameUI(gameId: string, uiConfig?: { mode: string; url: string }): Promise<GameUIComponent | null> {
  try {
    // 1. Try loading from URL if config provided
    if (uiConfig?.mode === 'url' && uiConfig.url) {
      console.log(`Loading remote Game UI for ${gameId} from ${uiConfig.url}`);
      try {
        /* @vite-ignore */
        const module = await import(/* @vite-ignore */ uiConfig.url);
        return module.default as GameUIComponent;
      } catch (err) {
        console.error(`Failed to load remote UI from ${uiConfig.url}:`, err);
        // Fallback to registry if remote fails? or just throw?
        // Let's continue to registry check as fallback or if not URL mode
      }
    }

    // 2. Check if the game is registered locally
    if (gameId in gameUIRegistry) {
      const module = await gameUIRegistry[gameId]();
      return module.default as GameUIComponent;
    }

    console.error(`Game UI not registered for ${gameId}`);
    return null;
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

