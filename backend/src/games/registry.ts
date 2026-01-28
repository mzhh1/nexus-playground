/**
 * Game Registry
 * Enhanced registry supporting both static and dynamic game loading
 */

import { GameLogic } from './types.js';
import logger from '../utils/logger.js';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory for resolving relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============ Static Registry (Fallback) ============

// Import game logic modules statically for bundled deployments
import TicTacToeLogic from '../../../games/tic-tac-toe/logic/index.js';
import GomokuLogic from '../../../games/gomoku/logic/index.js';
import XiangqiLogic from '../../../games/xiangqi/logic/index.js';
import WerewolfLogic from '../../../games/werewolf/logic/index.js';

const staticRegistry: Record<string, GameLogic> = {
  'tic-tac-toe': TicTacToeLogic,
  'gomoku': GomokuLogic,
  'xiangqi': XiangqiLogic,
  'werewolf': WerewolfLogic,
};

// ============ Dynamic Registry ============

/**
 * Game registry - maps game ID to game logic implementation
 */
export const gameRegistry: Record<string, GameLogic> = { ...staticRegistry };

/**
 * Game version info for frontend handshake
 */
export interface GameVersionInfo {
  gameId: string;
  logicVersion: number;
  minClientVersion: number;
}

const gameVersions: Map<string, GameVersionInfo> = new Map();

// ============ Configuration ============

interface GameConfig {
  id: string;
  enabled: boolean;
  logicModule?: string;
  minClientVersion?: number;
}

interface GamesConfigFile {
  games: GameConfig[];
}

/**
 * Load games configuration from file
 */
function loadGamesConfig(): GamesConfigFile | null {
  const configPath = process.env.GAMES_CONFIG_PATH ||
    resolve(__dirname, '../../../../config/games.json');

  if (!existsSync(configPath)) {
    logger.debug({ configPath }, 'Games config file not found, using static registry');
    return null;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as GamesConfigFile;
    logger.info({ configPath, gameCount: config.games.length }, 'Loaded games configuration');
    return config;
  } catch (error) {
    logger.error({ error, configPath }, 'Failed to load games configuration');
    return null;
  }
}

/**
 * Initialize game registry from configuration
 * This re-initializes the registry based on config file
 */
export async function initializeRegistry(): Promise<void> {
  const config = loadGamesConfig();

  if (!config) {
    // Use static registry
    logger.info({ games: Object.keys(staticRegistry) }, 'Using static game registry');

    // Extract version info from static registry
    for (const [gameId, logic] of Object.entries(staticRegistry)) {
      const metadata = logic.getMetadata();
      gameVersions.set(gameId, {
        gameId,
        logicVersion: (metadata as any).logicVersion ?? 1,
        minClientVersion: 1,
      });
    }
    return;
  }

  // Clear dynamic entries (keep static as fallback)
  for (const gameId of Object.keys(gameRegistry)) {
    if (!(gameId in staticRegistry)) {
      delete gameRegistry[gameId];
    }
  }

  // Apply config to registry
  for (const game of config.games) {
    if (!game.enabled) {
      // Remove disabled games from registry
      delete gameRegistry[game.id];
      logger.debug({ gameId: game.id }, 'Game disabled by config');
      continue;
    }

    // If game exists in static registry, use it
    if (game.id in staticRegistry) {
      gameRegistry[game.id] = staticRegistry[game.id];
      const metadata = staticRegistry[game.id].getMetadata();
      gameVersions.set(game.id, {
        gameId: game.id,
        logicVersion: (metadata as any).logicVersion ?? 1,
        minClientVersion: game.minClientVersion ?? 1,
      });
      logger.debug({ gameId: game.id }, 'Game enabled from static registry');
    } else {
      logger.warn({ gameId: game.id }, 'Game not found in static registry');
    }
  }

  logger.info({ games: Object.keys(gameRegistry) }, 'Game registry initialized from config');
}

// ============ Public API ============

/**
 * Get game logic by ID
 * @param gameId Game identifier
 * @returns GameLogic implementation
 * @throws Error if game not found
 */
export function getGameLogic(gameId: string): GameLogic {
  const logic = gameRegistry[gameId];

  if (!logic) {
    logger.error({ gameId, availableGames: Object.keys(gameRegistry) }, 'Game not found in registry');
    throw new Error(`Game logic not found: ${gameId}`);
  }

  return logic;
}

/**
 * List all available games
 * @returns Array of game IDs
 */
export function listAvailableGames(): string[] {
  return Object.keys(gameRegistry);
}

/**
 * Check if game exists
 * @param gameId Game identifier
 * @returns True if game exists
 */
export function gameExists(gameId: string): boolean {
  return gameId in gameRegistry;
}

/**
 * Get all game metadata
 * @returns Array of game metadata
 */
export function getAllGamesMetadata() {
  return Object.values(gameRegistry).map(logic => logic.getMetadata());
}

/**
 * Get version info for all games (for frontend handshake)
 */
export function getAllGameVersions(): GameVersionInfo[] {
  return Array.from(gameVersions.values());
}

/**
 * Get version info for a specific game
 */
export function getGameVersion(gameId: string): GameVersionInfo | null {
  return gameVersions.get(gameId) ?? null;
}

// Initialize registry on module load
initializeRegistry().then(() => {
  logger.info({ games: listAvailableGames() }, 'Game registry ready');
}).catch(error => {
  logger.error({ error }, 'Failed to initialize game registry');
});
