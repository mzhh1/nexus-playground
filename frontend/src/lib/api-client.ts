/**
 * Type-safe API Client for Game Backend — v4.1
 */

import { useLogto } from '@logto/react';
import { useMemo, useRef } from 'react';
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import type { RoomInfo, EngineConnectionResponse } from './types';
import { BACKEND_RESOURCE } from './logto';
import { ApiHttpError, TokenAcquisitionError } from './auth-errors';

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
  const { getAccessToken, isAuthenticated } = useLogto();
  const authRef = useRef(isAuthenticated);
  authRef.current = isAuthenticated;

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
        if (authRef.current) {
          try {
            const token = await getAccessToken(BACKEND_RESOURCE);
            if (!token) {
              throw new TokenAcquisitionError('无法获取访问令牌，请重新登录后重试。');
            }
            config.headers.Authorization = `Bearer ${token}`;
          } catch (err) {
            if (err instanceof TokenAcquisitionError) throw err;
            throw new TokenAcquisitionError(
              err instanceof Error ? err.message : '获取访问令牌失败',
            );
          }
        } else {
          const guestId = getOrCreateGuestId();
          config.headers['X-Guest-Id'] = guestId;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    // Response interceptor: 401 (non-insufficient_scope) → retry once
    instance.interceptors.response.use(
      (response) => response,
      async (error) => {
        // TokenAcquisitionError from request interceptor — propagate immediately
        if (error instanceof TokenAcquisitionError) {
          return Promise.reject(error);
        }

        if (axios.isAxiosError(error) && error.response) {
          const apiError = new ApiHttpError(
            error.response.status,
            error.response.data?.error as string | undefined,
            error.response.data?.error_description as string | undefined,
            typeof error.response.data === 'object'
              ? JSON.stringify(error.response.data)
              : String(error.response.data),
          );

          const origConfig = error.config;
          // 仅 insufficent_scope 尝试刷新 token 重试一次
          if (apiError.isInsufficientScope && origConfig && !(origConfig as any)._retry) {
            (origConfig as any)._retry = true;
            try {
              const newToken = await getAccessToken(BACKEND_RESOURCE);
              if (newToken) {
                origConfig.headers.Authorization = `Bearer ${newToken}`;
                return instance(origConfig);
              }
            } catch {
              // 刷新失败，抛出原始错误
            }
          }

          return Promise.reject(apiError);
        }

        return Promise.reject(error);
      },
    );

    return instance;
  }, [getAccessToken]);

  return useMemo(() => new GameAPI(gameAxios), [gameAxios]);
}
