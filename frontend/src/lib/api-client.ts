/**
 * API Client
 * Handles all HTTP requests to the backend
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type { 
  RoomInfo, 
  RolePerspective, 
  Action, 
  PlayerList, 
  RoleMapping, 
  ApiError 
} from './types';

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseURL: string) {
    this.client = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });

    // Add request interceptor for auth (M0: using X-User-Id header)
    this.client.interceptors.request.use((config) => {
      // M0: Temporary auth using X-User-Id header
      // In production, use OAuth tokens
      const userId = localStorage.getItem('userId') || 'test_user_1';
      config.headers['X-User-Id'] = userId;
      
      // Generate request ID
      config.headers['X-Request-Id'] = this.generateRequestId();
      
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  // ============ My Nexus Routes ============

  async getMyNexus(): Promise<RoomInfo> {
    const response = await this.client.get<RoomInfo>('/my-nexus');
    return response.data;
  }

  async selectGame(gameId: string): Promise<{ success: true; game_id: string }> {
    const response = await this.client.post('/my-nexus/select-game', { game_id: gameId });
    return response.data;
  }

  async addPlayer(player: {
    player_type: 'human' | 'llm';
    uid?: string;
    display_name: string;
    model_name?: string;
    system_prompt?: string;
  }): Promise<{ success: true; player_id: string; player: any }> {
    const response = await this.client.post('/my-nexus/add-player', player);
    return response.data;
  }

  async removePlayer(playerId: string): Promise<{ success: true }> {
    const response = await this.client.post('/my-nexus/remove-player', { player_id: playerId });
    return response.data;
  }

  async startGame(roleMapping: RoleMapping): Promise<{ success: true }> {
    const response = await this.client.post('/my-nexus/start', { role_mapping: roleMapping });
    return response.data;
  }

  async pauseGame(): Promise<{ success: true }> {
    const response = await this.client.post('/my-nexus/pause');
    return response.data;
  }

  async resumeGame(): Promise<{ success: true }> {
    const response = await this.client.post('/my-nexus/resume');
    return response.data;
  }

  async stopGame(): Promise<{ success: true }> {
    const response = await this.client.post('/my-nexus/stop');
    return response.data;
  }

  // ============ Room Routes ============

  async getRoomInfo(roomId: string): Promise<RoomInfo> {
    const response = await this.client.get<RoomInfo>(`/rooms/${roomId}`);
    return response.data;
  }

  async joinRoom(roomId: string, displayName: string): Promise<{ success: true; player_id: string; player: any }> {
    const response = await this.client.post(`/rooms/${roomId}/join`, { display_name: displayName });
    return response.data;
  }

  // ============ Action Routes ============

  async submitAction(roomId: string, action: Action): Promise<{ success: true; message: string }> {
    const response = await this.client.post(`/rooms/${roomId}/actions`, action);
    return response.data;
  }

  // ============ Perspective Routes ============

  async getPerspective(roomId: string, roleId: string): Promise<RolePerspective> {
    const response = await this.client.get<RolePerspective>(
      `/rooms/${roomId}/perspectives/${roleId}`
    );
    return response.data;
  }

  // ============ Helper Methods ============

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  // ============ Set User ID (for M0 testing) ============

  setUserId(userId: string): void {
    localStorage.setItem('userId', userId);
  }

  getUserId(): string {
    return localStorage.getItem('userId') || 'test_user_1';
  }
}

/**
 * Create API client instance
 */
export function createApiClient(): ApiClient {
  const baseURL = import.meta.env.VITE_BACKEND_BASE_URL || '/api/v1';
  return new ApiClient(baseURL);
}

/**
 * Singleton instance
 */
let apiClientInstance: ApiClient | null = null;

export function getApiClient(): ApiClient {
  if (!apiClientInstance) {
    apiClientInstance = createApiClient();
  }
  return apiClientInstance;
}

