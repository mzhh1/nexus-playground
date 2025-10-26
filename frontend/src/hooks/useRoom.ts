/**
 * useRoom Hook
 * Manages room state and operations
 */

import { useState, useEffect, useCallback } from 'react';
import { getApiClient } from '../lib/api-client';
import type { RoomInfo } from '../lib/types';

export function useRoom(roomId?: string) {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiClient = getApiClient();

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
      setError(err.response?.data?.error || 'Failed to fetch room');
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
      setError(err.response?.data?.error || 'Failed to fetch nexus');
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
      setError(err.response?.data?.error || 'Failed to select game');
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
      setError(err.response?.data?.error || 'Failed to add player');
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
      setError(err.response?.data?.error || 'Failed to remove player');
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
      setError(err.response?.data?.error || 'Failed to start game');
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
      setError(err.response?.data?.error || 'Failed to pause game');
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
      setError(err.response?.data?.error || 'Failed to resume game');
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
      setError(err.response?.data?.error || 'Failed to stop game');
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
      setError(err.response?.data?.error || 'Failed to join room');
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

