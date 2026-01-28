/**
 * usePerspective Hook
 * Subscribes to perspective updates via SSE
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOAuth } from '@autolabz/oauth-sdk';
import type { RolePerspective } from '../lib/types';

export interface PerspectiveEventCallbacks {
  onGameStarted?: (data: any) => void;
  onGamePaused?: () => void;
  onGameResumed?: () => void;
  onGameStopped?: () => void;
  onGameRestarted?: () => void;
  onPlayerJoined?: (data: any) => void;
  onPlayerLeft?: (data: any) => void;
  onRoleMappingUpdated?: (data: any) => void;
  onPlayerStatusChanged?: (data: any) => void;
}

export function usePerspective(
  roomId: string | null, 
  roleId: string | null, 
  playerId?: string,
  callbacks?: PerspectiveEventCallbacks
) {
  const [perspective, setPerspective] = useState<RolePerspective | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const auth = useOAuth();
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const ticketRef = useRef<string | null>(null);
  const ticketExpiryRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const healthCheckIntervalRef = useRef<number | null>(null);
  const callbacksRef = useRef<PerspectiveEventCallbacks | undefined>(callbacks);

  // Update callbacks ref when it changes
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  /**
   * Step 1: Get SSE authentication ticket from backend
   */
  const getTicket = useCallback(async (): Promise<string | null> => {
    if (!roomId || !roleId) return null;

    try {
      const token = await auth.getAccessToken();
      if (!token) {
        throw new Error('No access token available');
      }

      // Use relative path to go through Nginx proxy
      const baseURL = '/api/v1';
      const ticketUrl = `${baseURL}/rooms/${roomId}/perspectives/${roleId}/ticket${playerId ? `?player_id=${playerId}` : ''}`;

      const headers: Record<string, string> = {
        'Authorization': `Bearer ${token}`,
      };

      // Add X-Client-Id header if available
      const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
      if (clientId) {
        headers['X-Client-Id'] = clientId;
      }

      const response = await fetch(ticketUrl, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        throw new Error(`Failed to get ticket: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Store ticket expiry time
      ticketExpiryRef.current = Date.now() + (data.expiresIn * 1000);
      
      return data.ticket;
    } catch (err) {
      console.error('Failed to get SSE ticket:', err);
      setError('Failed to authenticate SSE connection');
      return null;
    }
  }, [roomId, roleId, playerId, auth]);

  /**
   * Step 2: Connect to SSE stream with ticket
   */
  const connect = useCallback(async () => {
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
      // Get fresh ticket
      const ticket = await getTicket();
      if (!ticket) {
        setError('Failed to get authentication ticket');
        return;
      }

      ticketRef.current = ticket;

      // Build SSE URL - use relative path to go through Nginx proxy
      const baseURL = '/api/v1';
      const urlPath = `${baseURL}/rooms/${roomId}/perspectives/${roleId}/stream`;
      const params = new URLSearchParams();
      params.set('ticket', ticket);
      
      if (playerId) {
        params.set('player_id', playerId);
      }

      const fullUrl = `${urlPath}?${params.toString()}`;
      console.log('[SSE] Connecting to:', fullUrl);
      console.log('[SSE] Current location:', window.location.href);
      console.log('[SSE] Ticket:', ticket.substring(0, 10) + '...');

      const eventSource = new EventSource(fullUrl);

      eventSource.onopen = () => {
        console.log('[SSE] Connection opened successfully');
        console.log('[SSE] ReadyState:', eventSource.readyState); // Should be 1 (OPEN)
        setConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0; // Reset reconnect attempts on successful connection
        
        // Start health check interval
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
        }
        healthCheckIntervalRef.current = setInterval(() => {
          if (eventSourceRef.current) {
            const readyState = eventSourceRef.current.readyState;
            console.log('[SSE] Health check - ReadyState:', readyState);
            
            // If connection is closed (readyState === 2), clean up
            if (readyState === 2) {
              console.warn('[SSE] Connection closed, cleaning up...');
              setConnected(false);
              if (healthCheckIntervalRef.current) {
                clearInterval(healthCheckIntervalRef.current);
                healthCheckIntervalRef.current = null;
              }
            }
          }
        }, 5000); // Check every 5 seconds
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
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current?.onGameStarted?.(data);
        } catch (err) {
          console.error('Failed to parse game_started data:', err);
          callbacksRef.current?.onGameStarted?.({});
        }
      });

      eventSource.addEventListener('game_paused', (event) => {
        console.log('Game paused event:', event.data);
        callbacksRef.current?.onGamePaused?.();
      });

      eventSource.addEventListener('game_resumed', (event) => {
        console.log('Game resumed event:', event.data);
        callbacksRef.current?.onGameResumed?.();
      });

      eventSource.addEventListener('game_stopped', (event) => {
        console.log('Game stopped event:', event.data);
        // Clear perspective when game is stopped
        setPerspective(null);
        callbacksRef.current?.onGameStopped?.();
      });

      eventSource.addEventListener('game_restarted', (event) => {
        console.log('Game restarted event:', event.data);
        // Don't clear perspective here - it will be updated by the new perspective event
        // that the backend sends immediately after game_restarted
        callbacksRef.current?.onGameRestarted?.();
      });

      eventSource.addEventListener('player_joined', (event) => {
        console.log('Player joined event:', event.data);
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current?.onPlayerJoined?.(data);
        } catch (err) {
          console.error('Failed to parse player_joined data:', err);
        }
      });

      eventSource.addEventListener('player_left', (event) => {
        console.log('Player left event:', event.data);
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current?.onPlayerLeft?.(data);
        } catch (err) {
          console.error('Failed to parse player_left data:', err);
        }
      });

      eventSource.addEventListener('role_mapping_updated', (event) => {
        console.log('Role mapping updated event:', event.data);
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current?.onRoleMappingUpdated?.(data);
        } catch (err) {
          console.error('Failed to parse role_mapping_updated data:', err);
        }
      });

      eventSource.addEventListener('player_status_changed', (event) => {
        console.log('Player status changed event:', event.data);
        try {
          const data = JSON.parse(event.data);
          callbacksRef.current?.onPlayerStatusChanged?.(data);
        } catch (err) {
          console.error('Failed to parse player_status_changed data:', err);
        }
      });

      eventSource.onerror = (err) => {
        console.error('[SSE] Error event:', {
          readyState: eventSource.readyState,
          url: eventSource.url,
          error: err
        });
        setConnected(false);
        
        // Clear health check on error
        if (healthCheckIntervalRef.current) {
          clearInterval(healthCheckIntervalRef.current);
          healthCheckIntervalRef.current = null;
        }
        
        // Limit reconnection attempts to prevent infinite loops
        const MAX_RECONNECT_ATTEMPTS = 5;
        reconnectAttemptsRef.current += 1;
        
        if (reconnectAttemptsRef.current > MAX_RECONNECT_ATTEMPTS) {
          console.error('Max reconnection attempts reached, stopping reconnection');
          setError('Failed to establish connection after multiple attempts');
          if (eventSourceRef.current) {
            eventSourceRef.current.close();
            eventSourceRef.current = null;
          }
          return;
        }
        
        // Check if ticket is expiring or expired
        const now = Date.now();
        const ticketExpiry = ticketExpiryRef.current || 0;
        const ticketAge = ticketExpiry - now;
        
        // If ticket expires in less than 10 seconds, get a new one
        if (ticketAge < 10000) {
          console.log(`Ticket expired or expiring, reconnecting with new ticket... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          setError('Connection expired, reconnecting...');
          setTimeout(() => {
            if (eventSourceRef.current === eventSource) {
              connect(); // Get new ticket and reconnect
            }
          }, 1000);
        } else {
          setError('Connection error');
          setTimeout(() => {
            if (eventSourceRef.current === eventSource) {
              console.log(`Retrying connection... (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
              connect(); // Retry with same ticket (if still valid)
            }
          }, 3000);
        }
      };

      eventSourceRef.current = eventSource;
    } catch (err) {
      console.error('Failed to create EventSource:', err);
      setError('Failed to connect');
      reconnectAttemptsRef.current += 1;
    }
  }, [roomId, roleId, playerId, getTicket]);

  /**
   * Disconnect from SSE stream
   */
  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting...');
    
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setConnected(false);
    }
    
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
    
    ticketRef.current = null;
    ticketExpiryRef.current = null;
    reconnectAttemptsRef.current = 0;
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
  }, [roomId, roleId, playerId, connect, disconnect]);

  return {
    perspective,
    connected,
    error,
    connect,
    disconnect,
  };
}

