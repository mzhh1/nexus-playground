DROP TABLE IF EXISTS rooms;

CREATE TABLE rooms (
  room_id TEXT PRIMARY KEY,
  owner_uid TEXT NOT NULL UNIQUE,
  room_name TEXT NOT NULL,
  game_id TEXT,
  room_status TEXT NOT NULL DEFAULT 'lobby'
    CHECK (room_status IN ('lobby', 'playing', 'paused', 'finished')),
  is_public INTEGER NOT NULL DEFAULT 1
    CHECK (is_public IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rooms_created_at ON rooms(created_at);
