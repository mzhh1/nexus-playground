/**
 * @nexus/game-sdk - Game UI Type Definitions
 * Interface for game UI components in Module Federation
 */

import type { RolePerspective, Action, GameLogic, GameMetadata } from './game-logic';

/**
 * Props passed to game UI components
 */
export interface GameUIProps {
    /**
     * Role perspective (from backend)
     */
    perspective: RolePerspective;

    /**
     * Callback to submit an action
     */
    onAction: (action: Action) => void;

    /**
     * Is it current player's turn?
     */
    isMyTurn: boolean;

    /**
     * Is the game in read-only mode? (观察或终局暂停)
     */
    readonly: boolean;

    /**
     * Additional metadata
     */
    metadata?: GameUIMetadata;
}

/**
 * UI metadata passed from host
 */
export interface GameUIMetadata {
    roomId: string;
    roleId: string;
    playerId?: string;
}

/**
 * Game UI component type
 */
export type GameUIComponent = React.FC<GameUIProps>;

/**
 * Game Remote Module contract
 * Each game remote must expose these modules
 */
export interface GameRemoteModule {
    /** UI component (default export from ./UI) */
    UI: GameUIComponent;
    /** Game logic instance (default export from ./Logic) */
    Logic: GameLogic;
    /** Game metadata (named export from ./Metadata) */
    metadata: GameMetadata;
}

/**
 * Version info for handshake protocol
 */
export interface GameVersionInfo {
    /** Game ID */
    gameId: string;
    /** Logic version from server */
    logicVersion: number;
    /** Minimum client version required */
    minClientVersion: number;
}
