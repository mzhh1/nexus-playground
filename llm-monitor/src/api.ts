import {
  InteractionDetailResponse,
  InteractionGroupResponse,
  InteractionListResponse,
  InteractionStatus,
} from './types';

const API_BASE_URL =
  import.meta.env.VITE_MONITOR_API_BASE_URL?.replace(/\/$/, '') || '/api/v1';

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
  roomId?: string;
  roleId?: string;
  gameId?: string;
  interactionGroupId?: string;
  limit?: number;
  offset?: number;
  order?: 'asc' | 'desc';
}

async function request<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);

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
    roomId,
    roleId,
    gameId,
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
  if (roomId) {
    searchParams.set('roomId', roomId);
  }
  if (roleId) {
    searchParams.set('roleId', roleId);
  }
  if (gameId) {
    searchParams.set('gameId', gameId);
  }
  if (interactionGroupId) {
    searchParams.set('interactionGroupId', interactionGroupId);
  }

  const url = `${API_BASE_URL}/llm-logs?${searchParams.toString()}`;
  return request<InteractionListResponse>(url);
}

export async function fetchInteractionGroup(
  groupId: string
): Promise<InteractionGroupResponse> {
  const url = `${API_BASE_URL}/llm-logs/groups/${groupId}`;
  return request<InteractionGroupResponse>(url);
}

export async function fetchInteractionDetail(
  interactionId: string
): Promise<InteractionDetailResponse> {
  const url = `${API_BASE_URL}/llm-logs/${interactionId}`;
  return request<InteractionDetailResponse>(url);
}








