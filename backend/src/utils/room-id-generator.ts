import { customAlphabet } from 'nanoid';

/**
 * Generates a random room ID using base62 encoding
 * Format: 8 characters, alphanumeric (0-9, a-z, A-Z)
 * 
 * Collision probability with 8 characters:
 * - 62^8 = ~218 trillion possible combinations
 * - With 1 million rooms, probability of collision < 0.000001%
 */

const base62Alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateNanoId = customAlphabet(base62Alphabet, 8);

/**
 * Generate a unique room ID
 * @returns {string} 8-character alphanumeric room ID
 */
export function generateRoomId(): string {
  return generateNanoId();
}

/**
 * Validate room ID format
 * @param roomId Room ID to validate
 * @returns {boolean} True if valid format
 */
export function isValidRoomId(roomId: string): boolean {
  if (!roomId || typeof roomId !== 'string') {
    return false;
  }
  
  // Must be exactly 8 characters, alphanumeric
  return /^[0-9A-Za-z]{8}$/.test(roomId);
}

