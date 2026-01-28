/**
 * @nexus/game-sdk - useActionSubmit Hook
 * Action submission hook for game UI components
 */

import { useCallback } from 'react';
import type { Action } from '../types';

export interface UseActionSubmitResult {
    /** Submit an action */
    submit: (actionId: string, params?: Record<string, unknown>) => void;
}

/**
 * Hook for submitting game actions
 */
export function useActionSubmit(
    onAction: (action: Action) => void,
    roleId: string
): UseActionSubmitResult {
    const submit = useCallback(
        (actionId: string, params?: Record<string, unknown>) => {
            const action: Action = {
                action_id: actionId,
                role_id: roleId,
            };
            if (params && Object.keys(params).length > 0) {
                action.params = params;
            }
            onAction(action);
        },
        [onAction, roleId]
    );

    return { submit };
}
