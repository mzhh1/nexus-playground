import {
  InteractionDetailResponse,
  InteractionGroupResponse,
  InteractionListResponse,
  PlayerType,
  InteractionStatus,
  LLMInteraction,
  RoomStateResponse,
} from './types';

export interface AuthConfig {
  baseUrl: string;
  adminSecret: string;
  backendUrl?: string; // Optional for backward compatibility, required for advanced backend monitoring
}

const STORAGE_KEY = 'llm_monitor_auth';

export function getAuthConfig(): AuthConfig | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function setAuthConfig(config: AuthConfig | null) {
  if (config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const DEFAULT_PAGE_SIZE = Number.parseInt(
  import.meta.env.VITE_MONITOR_PAGE_SIZE || '50',
  10
);

export const DEFAULT_REFRESH_INTERVAL = Number.parseInt(
  import.meta.env.VITE_MONITOR_REFRESH_INTERVAL_MS || '5000',
  10
);

export interface FetchInteractionsParams {
  status?: InteractionStatus | '';
  playerType?: PlayerType | '';
  roomId?: string;
  roleId?: string;
  gameId?: string;
  startDate?: string;
  endDate?: string;
  interactionGroupId?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

function withAuth(init?: RequestInit): RequestInit {
  const config = getAuthConfig();
  if (!config?.adminSecret) return init || {};
  return {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${config.adminSecret}`,
    },
  };
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, withAuth(init));

  if (!response.ok) {
    throw new Error(`请求失败：${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

export async function fetchInteractions(
  params: FetchInteractionsParams = {}
): Promise<InteractionListResponse> {
  const {
    status,
    playerType,
    roomId,
    roleId,
    gameId,
    startDate,
    endDate,
    interactionGroupId,
    limit = DEFAULT_PAGE_SIZE,
    offset = 0,
    order = 'desc',
  } = params;

  const searchParams = new URLSearchParams();
  searchParams.set('limit', String(limit));
  searchParams.set('offset', String(offset));
  searchParams.set('order', order);

  if (status) {
    searchParams.set('status', status);
  }
  if (playerType) {
    searchParams.set('playerType', playerType);
  }
  if (roomId) {
    searchParams.set('roomId', roomId);
  }
  if (roleId) {
    searchParams.set('roleId', roleId);
  }
  if (gameId) {
    searchParams.set('gameId', gameId);
  }
  if (startDate) {
    searchParams.set('startDate', startDate);
  }
  if (endDate) {
    searchParams.set('endDate', endDate);
  }
  if (interactionGroupId) {
    searchParams.set('interactionGroupId', interactionGroupId);
  }

  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  const url = `${baseUrl}/logs?${searchParams.toString()}`;
  return request<InteractionListResponse>(url);
}

export async function fetchInteractionGroup(
  groupId: string
): Promise<InteractionGroupResponse> {
  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  const url = `${baseUrl}/logs/groups/${groupId}`;
  return request<InteractionGroupResponse>(url);
}

export async function fetchInteractionDetail(
  interactionId: string
): Promise<InteractionDetailResponse> {
  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  const url = `${baseUrl}/logs/${interactionId}`;
  return request<InteractionDetailResponse>(url);
}

export interface ConnectLogStreamParams {
  roomId: string;
  status?: InteractionStatus | '';
  playerType?: PlayerType | '';
  roleId?: string;
  gameId?: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchRoomState(roomId: string): Promise<RoomStateResponse> {
  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  const url = `${baseUrl}/room/${roomId}`;
  return request<RoomStateResponse>(url);
}

export async function fetchRoomPerspective(roomId: string, roleId: string): Promise<{ data: any }> {
  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  const url = `${baseUrl}/room/${roomId}/perspective?roleId=${encodeURIComponent(roleId)}`;
  return request<{ data: any }>(url);
}

export async function submitRoomAction(roomId: string, roleId: string, actionId: string, params: any): Promise<any> {
  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  const url = `${baseUrl}/room/${roomId}/action`;
  return request<any>(url, {
    method: 'POST',
    body: JSON.stringify({
      roleId,
      action: { action_id: actionId, params },
    }),
  });
}

export function connectLogStream(
  params: ConnectLogStreamParams,
  onMessage: (log: LLMInteraction) => void,
  onError?: (error: Event) => void
): EventSource {
  const searchParams = new URLSearchParams();
  searchParams.set('roomId', params.roomId);
  if (params.status) searchParams.set('status', params.status);
  if (params.playerType) searchParams.set('playerType', params.playerType);
  if (params.roleId) searchParams.set('roleId', params.roleId);
  if (params.gameId) searchParams.set('gameId', params.gameId);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  const config = getAuthConfig();
  const baseUrl = config?.baseUrl?.replace(/\/$/, '') || '/api/monitor';
  if (config?.adminSecret) searchParams.set('token', config.adminSecret);

  const eventSource = new EventSource(`${baseUrl}/logs/stream?${searchParams.toString()}`);
  eventSource.addEventListener('log', (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as {
      kind: 'upsert';
      data: LLMInteraction;
    };
    if (payload?.kind === 'upsert' && payload.data) {
      onMessage(payload.data);
    }
  });
  if (onError) {
    eventSource.onerror = onError;
  }
  return eventSource;
}







export async function fetchBackendRooms(limit: number = 50, offset: number = 0): Promise<{ data: any[], total: number }> {
  const config = getAuthConfig();
  // Fallback to baseUrl if backendUrl is not explicitly set, though typically they differ
  const backendBaseUrl = config?.backendUrl?.replace(/\/$/, '') || (config?.baseUrl?.replace(/\/$/, '') || '/api');
  const url = `${backendBaseUrl}/monitor/backendroom?limit=${limit}&offset=${offset}`;

  // Since we also protect Backend monitoring with ADMIN_SECRET, we reuse the withAuth logic natively here.
  return request<{ data: any[], total: number }>(url);
}

export async function deleteBackendRoom(roomId: string): Promise<{ success: boolean }> {
  const config = getAuthConfig();
  const backendBaseUrl = config?.backendUrl?.replace(/\/$/, '') || (config?.baseUrl?.replace(/\/$/, '') || '/api');
  const url = `${backendBaseUrl}/monitor/backendroom/${roomId}`;
  return request<{ success: boolean }>(url, { method: 'DELETE' });
}
