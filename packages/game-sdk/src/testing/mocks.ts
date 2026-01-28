/**
 * @nexus/game-sdk - Test Mocks
 * Mock utilities for testing game UI components
 */

import type { RolePerspective, GameUIProps, Action } from '../types';

/**
 * Create a mock RolePerspective for testing
 */
export function createMockPerspective(
    overrides?: Partial<RolePerspective>
): RolePerspective {
    return {
        global_rules: 'Mock game rules for testing',
        whole_history: [],
        diff_history: [],
        current_state: {},
        your_role: {
            identity: 'player_1',
            goal: 'Win the game',
            is_current: true,
        },
        action_space_definition: {
            actions: [],
        },
        ...overrides,
    };
}

/**
 * Create mock GameUIProps for testing UI components
 */
export function createMockGameUIProps(
    overrides?: Partial<GameUIProps>
): GameUIProps {
    return {
        perspective: createMockPerspective(overrides?.perspective as Partial<RolePerspective>),
        onAction: () => { },
        isMyTurn: true,
        readonly: false,
        ...overrides,
    };
}

/**
 * Create a mock action handler that records actions
 */
export function createMockActionHandler(): {
    handler: (action: Action) => void;
    actions: Action[];
    clear: () => void;
    getLastAction: () => Action | undefined;
} {
    const actions: Action[] = [];

    return {
        handler: (action: Action) => {
            actions.push(action);
        },
        actions,
        clear: () => {
            actions.length = 0;
        },
        getLastAction: () => actions[actions.length - 1],
    };
}

/**
 * Wait for async state updates (useful in React testing)
 */
export function waitForStateUpdate(ms = 0): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
