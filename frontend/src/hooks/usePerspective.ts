/**
 * usePerspective Hook
 * Subscribes to perspective updates via SSE
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { RolePerspective } from '../lib/types';

export function usePerspective(roomId: string | null, roleId: string | null, playerId?: string) {
  const [perspective, setPerspective] = useState<RolePerspective | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);

  /**
   * Connect to SSE stream
   */
  const connect = useCallback(() => {
    if (!roomId || !roleId) {
      return;
    }

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setError(null);
    setConnected(false);

    try {
      const baseURL = import.meta.env.VITE_BACKEND_BASE_URL || '/api/v1';
      const url = new URL(`${baseURL}/rooms/${roomId}/perspectives/${roleId}/stream`, window.location.origin);
      
      if (playerId) {
        url.searchParams.set('player_id', playerId);
      }

      const eventSource = new EventSource(url.toString());

      eventSource.onopen = () => {
        console.log('SSE connection opened');
        setConnected(true);
        setError(null);
      };

      eventSource.addEventListener('connected', (event) => {
        console.log('SSE connected event:', event.data);
      });

      eventSource.addEventListener('perspective', (event) => {
        try {
          const data = JSON.parse(event.data);
          setPerspective(data);
          console.log('Perspective updated:', data);
        } catch (err) {
          console.error('Failed to parse perspective:', err);
        }
      });

      eventSource.addEventListener('game_started', (event) => {
        console.log('Game started event:', event.data);
      });

      eventSource.addEventListener('game_paused', (event) => {
        console.log('Game paused event:', event.data);
      });

      eventSource.addEventListener('game_resumed', (event) => {
        console.log('Game resumed event:', event.data);
      });

      eventSource.addEventListener('game_stopped', (event) => {
        console.log('Game stopped event:', event.data);
      });

      eventSource.onerror = (err) => {
        console.error('SSE error:', err);
        setConnected(false);
        setError('Connection error');
        
        // Attempt reconnection after delay
        setTimeout(() => {
          if (eventSourceRef.current === eventSource) {
            connect();
          }
        }, 3000);
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to connect');
    }
  }, [roomId, roleId, playerId]);

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
  }, []);

  /**
   * Connect on mount, disconnect on unmount
   */
  useEffect(() => {
    if (roomId && roleId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [roomId, roleId, playerId]);

  return {
    perspective,
    connected,
    error,
    connect,
    disconnect,
  };
}

