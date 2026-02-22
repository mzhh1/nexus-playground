/**
 * useAction Hook
 * Submits actions to the backend
 */

import { useState, useCallback } from 'react';
import type { Action } from '../lib/types';

export function useAction(roomId: string | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Submit an action
   */
  const submitAction = useCallback(async (action: Action) => {
    if (!roomId) {
      throw new Error('Room ID is required');
    }

    setSubmitting(true);
    setError(null);

    try {
      // Legacy hook kept for compatibility. Action submission is now handled
      // through useNexusEngine WebSocket flow in Room page.
      console.warn('useAction is deprecated. Use useNexusEngine.sendAction instead.', {
        roomId,
        action,
      });
    } catch (err: any) {
      const errorMessage = err?.response?.data?.error || 'Failed to submit action';
      setError(errorMessage);
      console.error('Failed to submit action:', err);
      throw new Error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  }, [roomId]);

  /**
   * Create and submit action
   */
  const performAction = useCallback(async (
    action_id: string,
    roleId: string,
    params?: Record<string, any>
  ) => {
    const action: Action = {
      action_id,
      role_id: roleId,
      params: params || {},
    };

    return submitAction(action);
  }, [submitAction]);

  return {
    submitAction,
    performAction,
    submitting,
    error,
  };
}

