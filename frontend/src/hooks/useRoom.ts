/**
 * useRoom Hook
 * Manages room state and operations
 */

import { useState, useCallback } from 'react';
import { useGameAPI } from '../lib/api-client';
import type { RoomInfo } from '../lib/types';

export function useRoom(roomId?: string) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = useGameAPI();

  const resolveRoomId = useCallback(() => {
    if (roomId) {
      return roomId;
    }
    if (room?.room_id) {
      return room.room_id;
    }
    throw new Error('Room ID is required for this operation');
  }, [roomId, room?.room_id]);

  /**
   * Fetch room info
   */
  const fetchRoom = useCallback(async () => {
    if (!roomId) return;

    setLoading(true);
    setError(null);

    try {
      const roomInfo = await apiClient.getRoomInfo(roomId);
      setRoom(roomInfo);
    } catch (err: any) {
      // 确保 error 始终是字符串，避免渲染对象导致 React 报错
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to fetch room';
      setError(errorMsg);
      console.error('Failed to fetch room:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  /**
   * Fetch my nexus
   */
  const fetchMyNexus = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const roomInfo = await apiClient.getMyNexus();
      setRoom(roomInfo);
    } catch (err: any) {
      // 确保 error 始终是字符串
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to fetch nexus';
      setError(errorMsg);
      console.error('Failed to fetch nexus:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshAfterMutation = useCallback(async () => {
    if (roomId) {
      await fetchRoom();
    } else {
      await fetchMyNexus();
    }
  }, [roomId, fetchRoom, fetchMyNexus]);

  /**
   * Select game
   */
  const selectGame = useCallback(async (gameId: string) => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.selectGame(targetRoomId, gameId);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to select game';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Add player
   */
  const addPlayer = useCallback(async (player: {
    player_type: 'human' | 'llm';
    uid?: string;
    display_name: string;
    model_name?: string;
    system_prompt?: string;
  }) => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      const result = await apiClient.addPlayer(targetRoomId, player);
      await refreshAfterMutation();
      return result;
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to add player';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Remove player
   */
  const removePlayer = useCallback(async (playerId: string) => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.removePlayer(targetRoomId, playerId);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to remove player';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Start game
   */
  const startGame = useCallback(async (roleMapping: Record<string, string>) => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.startGame(targetRoomId, roleMapping);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to start game';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Pause game
   */
  const pauseGame = useCallback(async () => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.pauseGame(targetRoomId);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to pause game';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Resume game
   */
  const resumeGame = useCallback(async () => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.resumeGame(targetRoomId);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to resume game';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Stop game
   */
  const stopGame = useCallback(async () => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.stopGame(targetRoomId);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to stop game';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Restart game
   */
  const restartGame = useCallback(async () => {
    setError(null);

    try {
      const targetRoomId = resolveRoomId();
      await apiClient.restartGame(targetRoomId);
      await refreshAfterMutation();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to restart game';
      setError(errorMsg);
      throw err;
    }
  }, [apiClient, resolveRoomId, refreshAfterMutation]);

  /**
   * Join room
   */
  const joinRoom = useCallback(async (displayName: string) => {
    if (!roomId) {
      throw new Error('Room ID is required');
    }

    setError(null);

    try {
      const result = await apiClient.joinRoom(roomId, displayName);
      // Refresh room info
      await fetchRoom();
      return result;
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to join room';
      setError(errorMsg);
      throw err;
    }
  }, [roomId, fetchRoom]);

  return {
    room,
    loading,
    error,
    fetchRoom,
    fetchMyNexus,
    selectGame,
    addPlayer,
    removePlayer,
    startGame,
    pauseGame,
    resumeGame,
    stopGame,
    restartGame,
    joinRoom,
  };
}

