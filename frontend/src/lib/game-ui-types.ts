/**
 * Game UI Type Definitions
 * Interface for game UI plugins
 */

import type { RolePerspective, Action } from './types';

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
   * Is the game in read-only mode? (observing or game finished)
   */
  readonly: boolean;

  /**
   * Additional metadata
   */
  metadata?: {
    roomId: string;
    roleId: string;
    playerId?: string;
  };
}

/**
 * Game UI Plugin Interface
 */
export interface GameUIPlugin {
  /**
   * Render function for the game UI
   */
  render(props: GameUIProps): JSX.Element;

  /**
   * Optional: Custom styles
   */
  styles?: string;
}

/**
 * Game UI component type
 */
export type GameUIComponent = React.FC<GameUIProps>;

