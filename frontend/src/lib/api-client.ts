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
import axios, type { AxiosInstance } from 'axios';
import type { RoomInfo, EngineConnectionResponse } from './types';

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
  const { apiClient, getAccessToken } = useOAuth();

  const gameAxios = axios.create({
    baseURL: import.meta.env.VITE_BACKEND_BASE_URL || '/api/v1',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor: Add authorization
  gameAxios.interceptors.request.use(
    async (config) => {
      const token = await getAccessToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
  gameAxios.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        try {
          await apiClient.refreshAccessToken();
          const newToken = await getAccessToken();
          if (newToken) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return gameAxios(originalRequest);
        } catch (refreshError) {
          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    }
  );

  return new GameAPI(gameAxios);
}
