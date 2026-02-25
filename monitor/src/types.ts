export type InteractionStatus =
  | 'pending'
  | 'retrying'
  | 'success'
  | 'failed'
  | 'rejected';

export type PlayerType = 'llm' | 'human';

export interface LLMInteraction {
  interaction_id: string;
  interaction_group_id: string;
  room_id: string;
  game_id: string | null;
  game_name: string | null;
  role_id: string;
  user_id: string | null;
  player_type: PlayerType;
  model_name: string | null;
  system_prompt: string | null;
  user_prompt: string | null;
  response: string | null;
  action_id: string | null;
  action_params_json: string | null;
  status: InteractionStatus;
  attempt: number;
  outer_attempt: number;
  max_attempts: number;
  previous_error: string | null;
  error_message: string | null;
  response_time_ms: number | null;
  event_ts: number;
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
    playerType?: PlayerType;
    gameId?: string;
    roleId?: string;
    startDate?: string;
    endDate?: string;
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

export interface RoomStateResponse {
  data: any; // EngineRoomState
}

