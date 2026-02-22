/**
 * Type-safe API Client for Game Backend — v4.0 Simplified
 *
 * After the Heavy Engine refactoring, this client only provides:
 *   - getMyNexus() — get/create user's room + Engine JWT
 *   - getRoomInfo() — get public room info
 *   - getEngineConnection() — get WebSocket URL + JWT
 *
 * All game operations (select game, add/remove players, start/stop,
 * actions, perspectives) are now handled via WebSocket to the Engine DO.
 */

import { useOAuth } from '@autolabz/oauth-sdk';
import { useMemo } from 'react';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { RoomInfo, EngineConnectionResponse } from './types';

/**
 * Get or create a stable guest ID for unauthenticated users
 */
function getOrCreateGuestId(): string {
  const KEY = 'nexus_guest_id';
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `guest_${Math.random().toString(36).substring(2, 10)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * Simplified Game API
 */
export class GameAPI {
  constructor(private client: AxiosInstance) { }

  // ============ Room APIs ============

  async getMyNexus(): Promise<RoomInfo> {
    const response = await this.client.get<RoomInfo>('/my-nexus');
    return response.data;
  }

  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    const response = await this.client.get<RoomInfo>(`/rooms/${roomId}`);
    return response.data;
  }

  async getEngineConnection(roomId: string): Promise<EngineConnectionResponse> {
    const response = await this.client.get<EngineConnectionResponse>(`/rooms/${roomId}/engine-connection`);
    return response.data;
  }
}

/**
 * Hook: Get game API client
 */
export function useGameAPI() {
  const { apiClient, getAccessToken, isAuthenticated } = useOAuth();
  let AuthenticatedState = isAuthenticated;
  const gameAxios = useMemo(() => {
    const instance = axios.create({
      baseURL: import.meta.env.VITE_BACKEND_BASE_URL,
      timeout: 3000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor: Add authorization
    instance.interceptors.request.use(
      async (config) => {
        const token = await getAccessToken();
        console.log('isAuthenticated:', isAuthenticated, AuthenticatedState, config.url);
        if (AuthenticatedState && token) {
          config.headers.Authorization = `Bearer ${token}`;
        } else {
          // For guests, send a stable ID from localStorage
          const guestId = getOrCreateGuestId();
          config.headers['X-Guest-Id'] = guestId;
        }

        const clientId = import.meta.env.VITE_OAUTH_CLIENT_ID;
        if (clientId) {
          config.headers['X-Client-Id'] = clientId;
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor: Handle 401 by refreshing token
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;
        console.log('error.response?.status:', error.response?.status, originalRequest._retry);
        if (error.response?.status === 401 && !originalRequest._retry) {
          AuthenticatedState = false;
          originalRequest._retry = true;

          try {
            await apiClient.refreshAccessToken();
            const newToken = await getAccessToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            return instance(originalRequest);
          } catch (refreshError) {
            console.error('Refresh token failed:', refreshError);
            delete originalRequest.headers.Authorization;
            const guestId = getOrCreateGuestId();
            originalRequest.headers['X-Guest-Id'] = guestId;
            return instance(originalRequest);
          }
        }

        console.error('API request error:', error);
        return Promise.reject(error);
      }
    );

    return instance;
  }, [getAccessToken, isAuthenticated, apiClient]);

  return useMemo(() => new GameAPI(gameAxios), [gameAxios]);
}
