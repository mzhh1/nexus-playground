/**
 * Game UI Type Definitions
 * Re-exports from @nexus/game-sdk for type consistency
 */

// Re-export from SDK for consistency with Module Federation
export type {
  GameUIProps,
  GameUIComponent,
  GameUIMetadata,
  GameRemoteModule,
  GameVersionInfo,
} from '@nexus/game-sdk';

// Also re-export core types for convenience
export type {
  RolePerspective,
  Action,
  ActionSpec,
  ActionDefinition,
} from '@nexus/game-sdk';

// Legacy support: GameUIPlugin interface (deprecated, use GameUIComponent)
import type { GameUIProps } from '@nexus/game-sdk';

/**
 * @deprecated Use GameUIComponent from SDK instead
 */
export interface GameUIPlugin {
  render(props: GameUIProps): JSX.Element;
  styles?: string;
}
