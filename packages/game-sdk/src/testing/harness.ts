/**
 * @nexus/game-sdk - Test Harness
 * Testing utilities for game logic
 */

import type {
    GameLogic,
    GameState,
    Action,
    ActionResult,
    HistoryEvent,
    RolePerspective,
} from '../types';

/**
 * Game test harness for automated testing
 */
export interface GameTestHarness<TState extends GameState> {
    /** Initialize game state */
    init(players: string[], options?: Record<string, unknown>): this;

    /** Get current state */
    getState(): TState;

    /** Get current role */
    getCurrentRole(): string;

    /** Get legal actions for a role */
    getLegalActions(roleId?: string): ReturnType<GameLogic<TState>['getLegalActions']>;

    /** Apply an action */
    applyAction(
        action: Omit<Action, 'role_id'>,
        roleId?: string
    ): ActionResult<TState>;

    /** Check if game is terminal */
    isTerminal(): boolean;

    /** Get winners */
    getWinners(): string[] | null;

    /** Get perspective for a role */
    getPerspective(roleId: string): RolePerspective;

    /** Get game history */
    getHistory(): HistoryEvent[];

    /** Simulate multiple actions */
    simulate(
        actions: Array<{ actionId: string; params?: Record<string, unknown>; roleId?: string }>
    ): this;

    /** Reset to initial state */
    reset(): this;
}

/**
 * Create a test harness for a game logic instance
 */
export function createGameTestHarness<TState extends GameState>(
    logic: GameLogic<TState>
): GameTestHarness<TState> {
    let state: TState;
    let history: HistoryEvent[] = [];
    let players: string[] = [];

    return {
        init(playerList: string[], options?: Record<string, unknown>) {
            players = playerList;
            state = logic.initState({ players: playerList, options });
            history = [];
            return this;
        },

        getState() {
            return state;
        },

        getCurrentRole() {
            return logic.getCurrentRole(state);
        },

        getLegalActions(roleId?: string) {
            return logic.getLegalActions(state, roleId || this.getCurrentRole());
        },

        applyAction(
            action: Omit<Action, 'role_id'>,
            roleId?: string
        ): ActionResult<TState> {
            const fullAction: Action = {
                ...action,
                role_id: roleId || this.getCurrentRole(),
            };

            const result = logic.applyAction(state, fullAction);

            if (result.success) {
                state = result.nextState;

                const event: HistoryEvent = {
                    turn: history.length + 1,
                    role_id: fullAction.role_id,
                    action: fullAction,
                    timestamp: new Date().toISOString(),
                };

                if (result.events && result.events.length > 0) {
                    history.push(...result.events);
                } else {
                    history.push(event);
                }
            }

            return result;
        },

        isTerminal() {
            return logic.isTerminal(state);
        },

        getWinners() {
            return logic.getWinners(state);
        },

        getPerspective(roleId: string) {
            return logic.toRolePerspective(state, roleId, history, []);
        },

        getHistory() {
            return [...history];
        },

        simulate(
            actions: Array<{ actionId: string; params?: Record<string, unknown>; roleId?: string }>
        ) {
            for (const { actionId, params, roleId } of actions) {
                if (this.isTerminal()) break;

                const result = this.applyAction(
                    { action_id: actionId, params },
                    roleId
                );

                if (!result.success) {
                    throw new Error(`Action "${actionId}" failed: ${result.error}`);
                }
            }
            return this;
        },

        reset() {
            return this.init(players);
        },
    };
}
