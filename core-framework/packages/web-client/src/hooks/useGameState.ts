/**
 * useGameState - 游戏状态管理Hook
 */

import { useState, useEffect, useCallback } from 'react';
import { RolePerspective, PlayerAction, GameStatus } from '@nexus/shared-types';
import { useWebSocket } from './useWebSocket';

export interface UseGameStateOptions {
  roomId: string;
  roleId: string;
  wsUrl: string;
  token?: string;
}

export function useGameState(options: UseGameStateOptions) {
  const [perspective, setPerspective] = useState<RolePerspective | null>(null);
  const [gameStatus, setGameStatus] = useState<GameStatus>('waiting');
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isConnected, emit, on } = useWebSocket({
    url: options.wsUrl,
    token: options.token,
    autoConnect: true,
  });

  useEffect(() => {
    if (!isConnected) return;

    // 加入房间
    emit('room:join', { roomId: options.roomId, roleId: options.roleId });

    // 监听游戏状态更新
    const unsubscribeStateUpdate = on('game:state-update', (data: any) => {
      if (data.perspective) {
        setPerspective(data.perspective);
        // 检查是否轮到我
        const currentRole = data.perspective.current_state?.current_role;
        setIsMyTurn(currentRole === options.roleId);
      }
      if (data.status) {
        setGameStatus(data.status);
      }
    });

    // 监听需要行动
    const unsubscribeActionRequired = on('game:action-required', (data: any) => {
      if (data.roleId === options.roleId) {
        setPerspective(data.perspective);
        setIsMyTurn(true);
      }
    });

    // 监听游戏结束
    const unsubscribeGameEnded = on('game:ended', (data: any) => {
      setGameStatus('finished');
      setIsMyTurn(false);
    });

    // 监听错误
    const unsubscribeError = on('game:error', (data: any) => {
      setError(data.error || 'An error occurred');
    });

    return () => {
      unsubscribeStateUpdate();
      unsubscribeActionRequired();
      unsubscribeGameEnded();
      unsubscribeError();
    };
  }, [isConnected, options.roomId, options.roleId, emit, on]);

  const submitAction = useCallback(
    async (action: PlayerAction) => {
      if (!isConnected) {
        throw new Error('Not connected to server');
      }

      if (!isMyTurn) {
        throw new Error('Not your turn');
      }

      setIsSubmitting(true);
      setError(null);

      try {
        emit('game:action', {
          roomId: options.roomId,
          action,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit action');
        throw err;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isConnected, isMyTurn, options.roomId, emit]
  );

  return {
    perspective,
    gameStatus,
    isMyTurn,
    isSubmitting,
    error,
    submitAction,
    isConnected,
  };
}

