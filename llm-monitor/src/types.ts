export type InteractionStatus =
  | 'pending'
  | 'retrying'
  | 'success'
  | 'failed'
  | 'rejected';

export interface LLMInteraction {
  interaction_id: string;
  interaction_group_id: string;
  room_id: string;
  game_id: string | null;
  game_name: string | null;
  role_id: string;
  model_name: string;
  system_prompt: string;
  user_prompt: string;
  response: string | null;
  status: InteractionStatus;
  attempt: number;
  outer_attempt: number;
  max_attempts: number;
  previous_error: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface InteractionListResponse {
  data: LLMInteraction[];
  pagination: {
    limit: number;
    offset: number;
    count: number;
    hasMore: boolean;
  };
  filters: {
    status?: InteractionStatus;
    roomId?: string;
    gameId?: string;
    roleId?: string;
    interactionGroupId?: string;
    order: 'asc' | 'desc';
  };
}

export interface InteractionGroupResponse {
  interaction_group_id: string;
  data: LLMInteraction[];
}

export interface InteractionDetailResponse {
  data: LLMInteraction;
}

