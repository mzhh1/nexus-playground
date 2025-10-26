import { customAlphabet } from 'nanoid';

/**
 * Generates room_player_id in format: {roomId}_{random6}
 * Example: ABC12345_a3Bc9Z
 */

const base62Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateNanoId = customAlphabet(base62Alphabet, 6);

/**
 * Generate a unique player ID for a room
 * @param roomId The room ID
 * @returns {string} room_player_id in format roomId_random6
 */
export function generatePlayerId(roomId: string): string {
  return `${roomId}_${generateNanoId()}`;
}

/**
 * Validate player ID format
 * @param playerId Player ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidPlayerId(playerId: string): boolean {
  if (!playerId || typeof playerId !== 'string') {
    return false;
  }
  
  // Must match format: roomId_random6
  return /^[0-9A-Za-z]{8}_[0-9A-Za-z]{6}$/.test(playerId);
}

/**
 * Extract room ID from player ID
 * @param playerId Player ID
 * @returns {string | null} Room ID or null if invalid format
 */
export function extractRoomIdFromPlayerId(playerId: string): string | null {
  if (!isValidPlayerId(playerId)) {
    return null;
  }
  
  return playerId.split('_')[0];
}

