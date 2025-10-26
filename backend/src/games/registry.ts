/**
 * Game Registry
 * Central registry for all available games
 */

import { GameLogic } from './types';
import TicTacToeLogic from '@games/tic-tac-toe/logic';
import logger from '../utils/logger';

/**
 * Game registry - maps game ID to game logic implementation
 */
export const gameRegistry: Record<string, GameLogic> = {
  'tic-tac-toe': TicTacToeLogic,
  // Add more games here as they are implemented
  // 'poker': PokerLogic,
  // 'go': GoLogic,
};

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

// Log available games on startup
logger.info(
  { games: listAvailableGames() },
  'Game registry initialized'
);

