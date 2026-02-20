import {
  InteractionDetailResponse,
  InteractionGroupResponse,
  InteractionListResponse,
  PlayerType,
  InteractionStatus,
  LLMInteraction,
} from './types';

const API_BASE_URL =
  import.meta.env.VITE_MONITOR_API_BASE_URL?.replace(/\/$/, '') || '/api/monitor';
const MONITOR_TOKEN = import.meta.env.VITE_MONITOR_TOKEN?.trim() || '';

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
  if (!MONITOR_TOKEN) return init || {};
  return {
    ...init,
    headers: {
      ...(init?.headers || {}),
      Authorization: `Bearer ${MONITOR_TOKEN}`,
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

  const url = `${API_BASE_URL}/logs?${searchParams.toString()}`;
  return request<InteractionListResponse>(url);
}

export async function fetchInteractionGroup(
  groupId: string
): Promise<InteractionGroupResponse> {
  const url = `${API_BASE_URL}/logs/groups/${groupId}`;
  return request<InteractionGroupResponse>(url);
}

export async function fetchInteractionDetail(
  interactionId: string
): Promise<InteractionDetailResponse> {
  const url = `${API_BASE_URL}/logs/${interactionId}`;
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
  if (MONITOR_TOKEN) searchParams.set('token', MONITOR_TOKEN);

  const eventSource = new EventSource(`${API_BASE_URL}/logs/stream?${searchParams.toString()}`);
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








