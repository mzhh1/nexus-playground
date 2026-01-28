/**
 * Game UI Loader with Module Federation Support
 * Dynamically loads game UI modules from federated remotes or local fallback
 */

import type { GameUIComponent } from './game-ui-types';
import type { GameVersionInfo } from '@nexus/game-sdk';

// ============ Configuration ============

// CDN base URL from environment
const GAME_CDN_BASE = import.meta.env.VITE_GAME_CDN_BASE || 'http://localhost:8080';

// Enabled games from environment (comma-separated)
const ENABLED_GAMES_STR = import.meta.env.VITE_ENABLED_GAMES || 'tic-tac-toe,gomoku,xiangqi,werewolf';
const ENABLED_GAMES = ENABLED_GAMES_STR.split(',').map((s: string) => s.trim());

// ============ Cache ============

const loadedModules: Map<string, GameUIComponent> = new Map();
const loadingPromises: Map<string, Promise<GameUIComponent | null>> = new Map();

// ============ Local Fallback Registry ============

/**
 * In development, Vite can resolve @games/* paths at runtime.
 * But TypeScript doesn't have visibility into these paths since games are separate packages.
 * The registry is populated at runtime if needed.
 */
const localGameRegistry: Record<string, () => Promise<{ default: GameUIComponent }>> = {};

// Populate at runtime when vite resolves @games paths (development only)
if (import.meta.env.DEV) {
  // These paths are handled by Vite's alias resolution at runtime
  // TypeScript cannot verify them, so we use dynamic imports with @vite-ignore
  Object.assign(localGameRegistry, {
    // @ts-ignore - Vite resolves these paths at runtime
    'tic-tac-toe': () => import(/* @vite-ignore */ '/games/tic-tac-toe/ui/ui.tsx'),
    // @ts-ignore
    'gomoku': () => import(/* @vite-ignore */ '/games/gomoku/ui/ui.tsx'),
    // @ts-ignore
    'xiangqi': () => import(/* @vite-ignore */ '/games/xiangqi/ui/ui.tsx'),
    // @ts-ignore
    'werewolf': () => import(/* @vite-ignore */ '/games/werewolf/ui/ui.tsx'),
  });
}

// ============ Module Federation Dynamic Import ============

/**
 * Dynamically import a federated module
 * This uses the runtime import mechanism for Module Federation
 */
async function importFederatedModule(gameId: string): Promise<{ default: GameUIComponent } | null> {
  const normalizedId = gameId.replace(/-/g, '_');
  const remoteName = `game_${normalizedId}`;

  try {
    // Module Federation exposes modules under the remote name
    // This works when the federation plugin is configured
    const module = await import(/* @vite-ignore */ `${remoteName}/UI`);
    return module;
  } catch (error) {
    console.warn(`Federation import failed for ${gameId}, trying alternative...`, error);

    // Try alternative path
    try {
      const altModule = await import(/* @vite-ignore */ remoteName);
      if (altModule.UI) {
        return { default: altModule.UI };
      }
      if (altModule.default) {
        return altModule;
      }
    } catch (altError) {
      console.warn(`Alternative federation import also failed for ${gameId}`, altError);
    }

    return null;
  }
}

// ============ Main Loader ============

/**
 * Load game UI component dynamically
 * Tries Module Federation first, falls back to local imports
 */
export async function loadGameUI(gameId: string): Promise<GameUIComponent | null> {
  // Check cache first
  if (loadedModules.has(gameId)) {
    return loadedModules.get(gameId)!;
  }

  // Check if already loading
  if (loadingPromises.has(gameId)) {
    return loadingPromises.get(gameId)!;
  }

  // Start loading
  const loadPromise = doLoadGameUI(gameId);
  loadingPromises.set(gameId, loadPromise);

  try {
    const result = await loadPromise;
    if (result) {
      loadedModules.set(gameId, result);
    }
    return result;
  } finally {
    loadingPromises.delete(gameId);
  }
}

async function doLoadGameUI(gameId: string): Promise<GameUIComponent | null> {
  // Check if game is enabled
  if (!ENABLED_GAMES.includes(gameId)) {
    console.error(`Game "${gameId}" is not enabled. Enabled games:`, ENABLED_GAMES);
    return null;
  }

  // Try Module Federation first (production)
  try {
    const federatedModule = await importFederatedModule(gameId);
    if (federatedModule) {
      console.log(`[GameLoader] Loaded ${gameId} via Module Federation`);
      return federatedModule.default;
    }
  } catch (error) {
    console.warn(`[GameLoader] Module Federation failed for ${gameId}:`, error);
  }

  // Fallback to local imports (development)
  if (gameId in localGameRegistry) {
    try {
      const localModule = await localGameRegistry[gameId]();
      console.log(`[GameLoader] Loaded ${gameId} via local import`);
      return localModule.default;
    } catch (error) {
      console.error(`[GameLoader] Local import failed for ${gameId}:`, error);
    }
  }

  console.error(`[GameLoader] Failed to load game UI for ${gameId}`);
  return null;
}

// ============ Version Handshake ============

/**
 * Verify game version compatibility with server
 */
export async function verifyGameVersion(
  gameId: string,
  serverVersion: GameVersionInfo
): Promise<{ compatible: boolean; needsRefresh: boolean; message?: string }> {
  try {
    const normalizedId = gameId.replace(/-/g, '_');
    const remoteName = `game_${normalizedId}`;

    // Try to get metadata from federated module
    const module = await import(/* @vite-ignore */ `${remoteName}/metadata`).catch(() => null);
    const clientVersion = module?.logicVersion ?? module?.default?.logicVersion;

    if (!clientVersion) {
      return { compatible: true, needsRefresh: false, message: 'Version check skipped (no client version)' };
    }

    if (clientVersion < serverVersion.minClientVersion) {
      return {
        compatible: false,
        needsRefresh: true,
        message: `Client version ${clientVersion} is outdated (server requires >=${serverVersion.minClientVersion})`,
      };
    }

    return { compatible: true, needsRefresh: false };
  } catch (error) {
    console.warn(`[GameLoader] Version check failed for ${gameId}:`, error);
    return { compatible: true, needsRefresh: false, message: 'Version check failed, proceeding anyway' };
  }
}

// ============ Utility Functions ============

/**
 * Check if game UI exists
 */
export function gameUIExists(gameId: string): boolean {
  return ENABLED_GAMES.includes(gameId) || gameId in localGameRegistry;
}

/**
 * Preload game UI (for performance)
 */
export async function preloadGameUI(gameId: string): Promise<void> {
  try {
    await loadGameUI(gameId);
  } catch (error) {
    console.warn(`[GameLoader] Failed to preload ${gameId}:`, error);
  }
}

/**
 * Get list of available game IDs
 */
export function getAvailableGameIds(): string[] {
  return ENABLED_GAMES;
}

/**
 * Clear module cache (useful for hot reload)
 */
export function clearGameCache(gameId?: string): void {
  if (gameId) {
    loadedModules.delete(gameId);
  } else {
    loadedModules.clear();
  }
}

/**
 * Get CDN URL for a game (for debugging)
 */
export function getGameCdnUrl(gameId: string): string {
  return `${GAME_CDN_BASE}/${gameId}/remoteEntry.js`;
}
