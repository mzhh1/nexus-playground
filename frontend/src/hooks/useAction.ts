/**
 * useAction Hook
 * Submits actions to the backend
 */

import { useState, useCallback } from 'react';
import { useGameAPI } from '../lib/api-client';
import type { Action } from '../lib/types';

export function useAction(roomId: string | null) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useGameAPI();

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
      await apiClient.submitAction(roomId, action);
      console.log('Action submitted successfully:', action);
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 'Failed to submit action';
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

