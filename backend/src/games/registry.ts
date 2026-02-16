/**
 * Game Registry
 * Central registry for all available games
 */

import fs from 'fs';
import path from 'path';
import { GameLogic } from '@nexus/game-sdk';
import { loadGameLogic } from './asset-loader.js';
import logger from '../utils/logger.js';
import { RemoteGameLogic } from './remote-logic.js';

/**
 * Game registry - maps game ID to game logic implementation
 */
export const gameRegistry: Record<string, GameLogic> = {};

const ASSETS_DIR = process.env.GAME_ASSETS_DIR || '/app/game-assets';

/**
 * Initialize game registry by scanning assets directory
 */
export async function initializeRegistry() {
  logger.info({ assetsDir: ASSETS_DIR }, 'Initializing game registry...');

  // 1. Register Remote Games (from Env)
  if (process.env.GOMOKU_WORKER_URL) {
    try {
      const gomokuLogic = new RemoteGameLogic('gomoku', process.env.GOMOKU_WORKER_URL);
      // Verify connection by fetching metadata
      await gomokuLogic.getMetadata();
      gameRegistry['gomoku'] = gomokuLogic;
      logger.info({ gameId: 'gomoku', url: process.env.GOMOKU_WORKER_URL }, 'Registered remote game');
    } catch (error) {
      logger.error({ error, url: process.env.GOMOKU_WORKER_URL }, 'Failed to register remote gomoku game');
    }
  }

  // 2. Register Local Games (from Assets Dir)
  if (!fs.existsSync(ASSETS_DIR)) {
    logger.warn('Game assets directory not found, skipping dynamic load');
    return;
  }

  try {
    const entries = fs.readdirSync(ASSETS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const gameId = entry.name;

        // Skip if already registered (e.g. via remote)
        if (gameRegistry[gameId]) {
          continue;
        }

        // Check for logic.mjs (Phase 1 convention)
        const logicPath = path.join(ASSETS_DIR, gameId, 'logic.mjs');

        if (fs.existsSync(logicPath)) {
          try {
            const logic = await loadGameLogic(gameId, logicPath);
            gameRegistry[gameId] = logic;
            logger.info({ gameId }, 'Registered game');
          } catch (err) {
            logger.error({ gameId, err }, 'Failed to register game');
          }
        }
      }
    }
  } catch (error) {
    logger.error({ error }, 'Failed to scan game assets directory');
  }

  logger.info({ games: Object.keys(gameRegistry) }, 'Game registry initialization complete');
}

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
export async function getAllGamesMetadata() {
  const metadataList = [];
  for (const [gameId, logic] of Object.entries(gameRegistry)) {
    const metadata = await logic.getMetadata();
    metadataList.push({
      ...metadata,
      workerUrl: getGameWorkerUrl(gameId) || undefined,
    });
  }
  return metadataList;
}

// Log available games on startup
logger.info(
  { games: listAvailableGames() },
  'Game registry initialized'
);

/**
 * Get game worker URL (if available)
 */
export function getGameWorkerUrl(gameId: string): string | undefined {
  if (gameId === 'gomoku') {
    return process.env.GOMOKU_WORKER_URL;
  }
  return undefined;
}
