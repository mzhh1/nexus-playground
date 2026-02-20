/**
 * Game UI Type Definitions
 * Types for iframe sandbox communication protocol
 */

import type { RolePerspective, Action } from './types';

// ============ iframe Communication Messages ============

/**
 * Message sent from parent (main site) to iframe (game UI)
 */
export interface SyncStateMessage {
  type: 'SYNC_STATE';
  payload: {
    perspective: RolePerspective;
    isMyTurn: boolean;
    readonly: boolean;
    metadata?: {
      roomId: string;
      roleId: string;
      playerId?: string;
    };
  };
}

/**
 * Message sent from iframe (game UI) to parent (main site)
 */
export interface ActMessage {
  type: 'ACT';
  payload: {
    action_id: string;
    role_id: string;
    params?: any;
  };
}

/**
 * Union type for all iframe messages
 */
export type GameIframeMessage = SyncStateMessage | ActMessage;
