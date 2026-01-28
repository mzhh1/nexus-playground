/**
 * @nexus/game-sdk - Logic Utilities
 * Common utility functions for game logic
 */

import type { Action, ActionSpec, GameMetadata, RolePerspective } from '../types';

/**
 * Spectator role ID (can be overridden via environment)
 */
export const SPECTATOR_ROLE_ID =
    (typeof process !== 'undefined' && process.env?.SPECTATOR_ROLE_ID) || 'spectator';

/**
 * Check if a role ID represents a spectator
 */
export function isSpectator(roleId: string): boolean {
    return roleId === SPECTATOR_ROLE_ID;
}

/**
 * Deep clone a state object
 */
export function cloneState<T>(state: T): T {
    return structuredClone(state);
}

/**
 * Validation result for action validation
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Validate an action against its specification
 */
export function validateAction(action: Action, spec: ActionSpec): ValidationResult {
    const definition = spec.actions.find((a) => a.action_id === action.action_id);

    if (!definition) {
        return { valid: false, error: `Unknown action: ${action.action_id}` };
    }

    // Check required parameters
    if (definition.params_schema) {
        for (const [key, schema] of Object.entries(definition.params_schema)) {
            const value = action.params?.[key];

            // Check required param exists
            if (value === undefined && schema.default === undefined) {
                return { valid: false, error: `Missing required parameter: ${key}` };
            }

            // Type validation (basic)
            if (value !== undefined) {
                const actualType = typeof value;
                const expectedType = schema.type;

                if (expectedType === 'integer' || expectedType === 'number') {
                    if (actualType !== 'number') {
                        return { valid: false, error: `Parameter ${key} must be a number` };
                    }
                    if (expectedType === 'integer' && !Number.isInteger(value)) {
                        return { valid: false, error: `Parameter ${key} must be an integer` };
                    }
                    if (schema.minimum !== undefined && (value as number) < schema.minimum) {
                        return { valid: false, error: `Parameter ${key} must be >= ${schema.minimum}` };
                    }
                    if (schema.maximum !== undefined && (value as number) > schema.maximum) {
                        return { valid: false, error: `Parameter ${key} must be <= ${schema.maximum}` };
                    }
                } else if (expectedType === 'string' && actualType !== 'string') {
                    return { valid: false, error: `Parameter ${key} must be a string` };
                } else if (expectedType === 'boolean' && actualType !== 'boolean') {
                    return { valid: false, error: `Parameter ${key} must be a boolean` };
                } else if (expectedType === 'array' && !Array.isArray(value)) {
                    return { valid: false, error: `Parameter ${key} must be an array` };
                }

                // Enum validation
                if (schema.enum && !schema.enum.includes(value)) {
                    return {
                        valid: false,
                        error: `Parameter ${key} must be one of: ${schema.enum.join(', ')}`,
                    };
                }
            }
        }
    }

    return { valid: true };
}

// ============ Multi-Player Count Utilities ============

/**
 * Check if roleIds is multi-player count config format
 */
export function isMultiPlayerCountConfig(
    roleIds: string[] | Record<number, string[]>
): roleIds is Record<number, string[]> {
    return typeof roleIds === 'object' && !Array.isArray(roleIds);
}

/**
 * Get role IDs for a specific player count
 */
export function getRoleIdsForPlayerCount(
    roleIds: string[] | Record<number, string[]>,
    playerCount?: number
): string[] {
    // Traditional format: return as-is
    if (Array.isArray(roleIds)) {
        return roleIds;
    }

    // Multi-player config: return for specified count
    if (playerCount !== undefined && roleIds[playerCount]) {
        return roleIds[playerCount];
    }

    // Fallback: return minimum player count config
    const counts = Object.keys(roleIds)
        .map(Number)
        .sort((a, b) => a - b);
    return counts.length > 0 ? roleIds[counts[0]] : [];
}

/**
 * Get available player counts for a multi-player game
 */
export function getAvailablePlayerCounts(
    roleIds: string[] | Record<number, string[]>
): number[] {
    if (isMultiPlayerCountConfig(roleIds)) {
        return Object.keys(roleIds)
            .map(Number)
            .sort((a, b) => a - b);
    }
    return [];
}

/**
 * Get status text from game metadata and perspective
 */
export function getGameStatusText(
    metadata: GameMetadata,
    perspective: RolePerspective
): string {
    if (metadata.getStatusText) {
        return metadata.getStatusText(perspective);
    }

    // Default status text
    if (perspective.your_role.is_current) {
        return 'Your turn';
    }
    return 'Waiting...';
}
