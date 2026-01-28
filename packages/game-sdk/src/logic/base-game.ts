/**
 * @nexus/game-sdk - Base Game Logic
 * Abstract base class for implementing game logic
 */

import type {
    GameLogic,
    GameState,
    GameMetadata,
    InitContext,
    ActionSpec,
    Action,
    ActionResult,
    HistoryEvent,
    RolePerspective,
} from '../types';
import { z } from 'zod';

/**
 * Default state prompt generator
 * Can be overridden by games for custom prompt formatting
 */
export function defaultStatePromptGenerator(perspective: RolePerspective): string {
    const lines: string[] = [];

    lines.push('=== Game Rules ===');
    lines.push(perspective.global_rules);
    lines.push('');

    lines.push('=== Your Role ===');
    lines.push(`Identity: ${perspective.your_role.identity}`);
    lines.push(`Goal: ${perspective.your_role.goal}`);
    lines.push(`Is Your Turn: ${perspective.your_role.is_current ? 'Yes' : 'No'}`);
    lines.push('');

    lines.push('=== Current State ===');
    lines.push(JSON.stringify(perspective.current_state, null, 2));
    lines.push('');

    if (perspective.diff_history.length > 0) {
        lines.push('=== Recent Events ===');
        for (const event of perspective.diff_history) {
            lines.push(`Turn ${event.turn}: ${event.description || JSON.stringify(event.action)}`);
        }
        lines.push('');
    }

    lines.push('=== Available Actions ===');
    for (const action of perspective.action_space_definition.actions) {
        if (action.params_schema) {
            const params = Object.keys(action.params_schema).join(', ');
            lines.push(`- ${action.action_id}(${params}): ${action.description}`);
        } else {
            lines.push(`- ${action.action_id}: ${action.description}`);
        }
    }

    return lines.join('\n');
}

/**
 * Abstract base class for game logic implementations
 * Provides common utilities and default implementations
 */
export abstract class BaseGameLogic<TState extends GameState>
    implements GameLogic<TState> {
    // ========== Abstract Methods (must implement) ==========

    abstract getMetadata(): GameMetadata;

    /**
     * Get the Zod schema for action validation
     * This schema should validate the 'payload' of the action
     */
    abstract getActionSchema(): z.ZodSchema;

    /**
     * Validate action payload against schema
     */
    validatePayload(actionPayload: any): boolean {
        const schema = this.getActionSchema();
        const result = schema.safeParse(actionPayload);
        if (!result.success) {
            console.error("Invalid Action Payload:", result.error);
            return false;
        }
        return true;
    }

    abstract initState(ctx: InitContext): TState;

    abstract getCurrentRole(state: TState): string;

    abstract getLegalActions(state: TState, roleId: string): ActionSpec;

    abstract applyAction(state: TState, action: Action): ActionResult<TState>;

    abstract isTerminal(state: TState): boolean;

    abstract getWinners(state: TState): string[] | null;

    abstract toRolePerspective(
        state: TState,
        roleId: string,
        wholeHistory: HistoryEvent[],
        diffHistory: HistoryEvent[]
    ): RolePerspective;

    // ========== Optional Methods (with defaults) ==========

    /**
     * Default state serialization using JSON
     * Override for states with Set, Map, or circular references
     */
    serializeState(state: TState): string {
        return JSON.stringify(state);
    }

    /**
     * Default state deserialization
     */
    deserializeState(data: string): TState {
        return JSON.parse(data) as TState;
    }

    /**
     * Default prompt generator
     * Override for custom LLM prompt formatting
     */
    generateStatePrompt(perspective: RolePerspective): string {
        return defaultStatePromptGenerator(perspective);
    }

    /**
     * Optional heuristic evaluation (for AI)
     * Override to enable simple AI opponents
     */
    evaluate?(state: TState, roleId: string): number;

    // ========== Utility Methods ==========

    /**
     * Deep clone a state object
     */
    protected cloneState(state: TState): TState {
        return structuredClone(state);
    }

    /**
     * Create a success result
     */
    protected createSuccessResult(
        nextState: TState,
        events?: HistoryEvent[]
    ): ActionResult<TState> {
        return { success: true, nextState, events };
    }

    /**
     * Create an error result
     */
    protected createErrorResult(
        error: string,
        errorCode?: string
    ): ActionResult<TState> {
        return { success: false, error, errorCode };
    }

    /**
     * Get the metadata version info (convenience method)
     */
    protected getVersionInfo() {
        const meta = this.getMetadata();
        return {
            version: meta.version,
            logicVersion: meta.logicVersion,
        };
    }
}
