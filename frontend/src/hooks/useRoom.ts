/**
 * useRoom Hook — v4.0 Simplified
 *
 * Only handles initial room loading from the Backend.
 * All room operations (game selection, player management, game lifecycle)
 * are now handled by useNexusEngine via WebSocket.
 */

import { useState, useEffect, useCallback } from 'react';
import { useGameAPI } from '../lib/api-client';

export interface RoomBasicInfo {
  room_id: string;
  owner_uid: string;
  game_id: string | null;
  room_status: string;
  is_public: boolean;
  created_at: string;
  updated_at: string;
  engine?: {
    url: string;
    token: string;
  };
}

export function useRoom() {
  const [room, setRoom] = useState<RoomBasicInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gameApi = useGameAPI();

  /**
   * Get or create the user's room (nexus)
   * Returns room info + Engine JWT for WebSocket connection
   */
  const fetchMyNexus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gameApi.getMyNexus();
      setRoom(data as any);
      return data;
    } catch (e: any) {
      const msg = e?.response?.data?.error || e.message || 'Failed to fetch room';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [gameApi]);

  /**
   * Fetch room info by ID (public info)
   */
  const fetchRoom = useCallback(async (roomId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gameApi.getRoomInfo(roomId);
      setRoom(data as any);
      return data;
    } catch (e: any) {
      const msg = e?.response?.data?.error || e.message || 'Failed to fetch room';
      setError(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [gameApi]);

  return {
    room,
    loading,
    error,
    fetchMyNexus,
    fetchRoom,
    roomId: room?.room_id ?? null,
  };
}
