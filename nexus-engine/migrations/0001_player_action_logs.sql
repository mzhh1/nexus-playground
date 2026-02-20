CREATE TABLE IF NOT EXISTS player_action_logs (
  interaction_id TEXT PRIMARY KEY,
  interaction_group_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  game_id TEXT,
  game_name TEXT,
  role_id TEXT NOT NULL,
  user_id TEXT,
  player_type TEXT NOT NULL CHECK(player_type IN ('llm', 'human')),
  model_name TEXT,
  system_prompt TEXT,
  user_prompt TEXT,
  response TEXT,
  action_id TEXT,
  action_params_json TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'retrying', 'success', 'failed', 'rejected')),
  attempt INTEGER NOT NULL DEFAULT 1,
  outer_attempt INTEGER NOT NULL DEFAULT 1,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  previous_error TEXT,
  error_message TEXT,
  response_time_ms INTEGER,
  event_ts INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_player_action_logs_room_eventts_id
ON player_action_logs (room_id, event_ts DESC, interaction_id DESC);

CREATE INDEX IF NOT EXISTS idx_player_action_logs_eventts_id
ON player_action_logs (event_ts DESC, interaction_id DESC);

CREATE INDEX IF NOT EXISTS idx_player_action_logs_group
ON player_action_logs (interaction_group_id, attempt ASC);

CREATE INDEX IF NOT EXISTS idx_player_action_logs_type_status_ts
ON player_action_logs (player_type, status, event_ts DESC);
