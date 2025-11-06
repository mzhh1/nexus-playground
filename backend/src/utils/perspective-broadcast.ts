/**
 * Perspective Broadcast Utilities
 * Provides unified logic for broadcasting perspectives to all players in a room
 */

import { StateManager } from '../runtime/state-manager.js';
import { PerspectiveGenerator } from '../runtime/perspective-generator.js';
import { EventBus } from '../runtime/event-bus.js';
import logger from './logger.js';
import { SPECTATOR_ROLE_ID } from '../games/types.js';

/**
 * Broadcast perspectives to all players in a room
 * This includes both role players and spectators
 * 
 * This is the SINGLE SOURCE OF TRUTH for perspective broadcasting logic.
 * All other code should use this function to ensure consistency.
 * 
 * @param roomId - The room ID
 * @param stateManager - State manager instance
 * @param perspectiveGenerator - Perspective generator instance
 * @param eventBus - Event bus instance
 */
export async function broadcastPerspectivesToAllPlayers(
  roomId: string,
  stateManager: StateManager,
  perspectiveGenerator: PerspectiveGenerator,
  eventBus: EventBus
): Promise<void> {
  const roomState = await stateManager.getRoomState(roomId);
  
  if (!roomState || !roomState.game_state) {
    logger.warn({ roomId }, 'Cannot broadcast perspectives - game not initialized');
    return;
  }

  // Build reverse mapping: room_player_id -> role_id
  const playerIdToRole = new Map<string, string>();
  for (const [roleId, playerId] of Object.entries(roomState.role_mapping)) {
    playerIdToRole.set(playerId, roleId);
  }

  // Broadcast updated perspectives to all players in the room
  // This includes both players with assigned roles AND spectators
  for (const roomPlayerId of Object.keys(roomState.player_list)) {
    // Get the player's role, or spectator role if not assigned to a role
    const roleId = playerIdToRole.get(roomPlayerId) || SPECTATOR_ROLE_ID;
    
    const perspective = await perspectiveGenerator.generatePerspective(
      roomId,
      roleId,
      { skipCache: true }
    );

    if (perspective) {
      eventBus.broadcastPerspective(roomId, roleId, perspective);
    }
  }

  logger.debug(
    { 
      roomId, 
      playerCount: Object.keys(roomState.player_list).length,
      roleCount: Object.keys(roomState.role_mapping).length,
      spectatorCount: Object.keys(roomState.player_list).length - Object.keys(roomState.role_mapping).length
    }, 
    'Perspectives broadcasted to all players'
  );
}

