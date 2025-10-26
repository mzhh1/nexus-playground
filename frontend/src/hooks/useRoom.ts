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

  /**
   * Select game
   */
  const selectGame = useCallback(async (gameId: string) => {
    setError(null);

    try {
      await apiClient.selectGame(gameId);
      // Refresh room info
      await fetchMyNexus();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to select game';
      setError(errorMsg);
      throw err;
    }
  }, [fetchMyNexus]);

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
      const result = await apiClient.addPlayer(player);
      // Refresh room info
      await fetchMyNexus();
      return result;
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to add player';
      setError(errorMsg);
      throw err;
    }
  }, [fetchMyNexus]);

  /**
   * Remove player
   */
  const removePlayer = useCallback(async (playerId: string) => {
    setError(null);

    try {
      await apiClient.removePlayer(playerId);
      // Refresh room info
      await fetchMyNexus();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to remove player';
      setError(errorMsg);
      throw err;
    }
  }, [fetchMyNexus]);

  /**
   * Start game
   */
  const startGame = useCallback(async (roleMapping: Record<string, string>) => {
    setError(null);

    try {
      await apiClient.startGame(roleMapping);
      // Refresh room info
      if (roomId) {
        await fetchRoom();
      } else {
        await fetchMyNexus();
      }
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to start game';
      setError(errorMsg);
      throw err;
    }
  }, [roomId, fetchRoom, fetchMyNexus]);

  /**
   * Pause game
   */
  const pauseGame = useCallback(async () => {
    setError(null);

    try {
      await apiClient.pauseGame();
      await fetchMyNexus();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to pause game';
      setError(errorMsg);
      throw err;
    }
  }, [fetchMyNexus]);

  /**
   * Resume game
   */
  const resumeGame = useCallback(async () => {
    setError(null);

    try {
      await apiClient.resumeGame();
      await fetchMyNexus();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to resume game';
      setError(errorMsg);
      throw err;
    }
  }, [fetchMyNexus]);

  /**
   * Stop game
   */
  const stopGame = useCallback(async () => {
    setError(null);

    try {
      await apiClient.stopGame();
      await fetchMyNexus();
    } catch (err: any) {
      const errorMsg = typeof err.response?.data?.error === 'string'
        ? err.response.data.error
        : err.response?.data?.message || err.message || 'Failed to stop game';
      setError(errorMsg);
      throw err;
    }
  }, [fetchMyNexus]);

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
    joinRoom,
  };
}

