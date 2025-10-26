-- This file is for reference only
-- The actual schema is in /database/init.sql which is executed on PostgreSQL container startup

-- Rooms table structure:
-- CREATE TABLE rooms (
--     room_id VARCHAR(16) PRIMARY KEY,
--     owner_uid VARCHAR(255) NOT NULL,
--     game_id VARCHAR(100),
--     room_status VARCHAR(20) NOT NULL DEFAULT 'open',
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     CONSTRAINT unique_owner_room UNIQUE (owner_uid)
-- );

-- Snapshots table structure:
-- CREATE TABLE snapshots (
--     snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     room_id VARCHAR(16) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
--     game_id VARCHAR(100) NOT NULL,
--     game_state JSONB NOT NULL,
--     turn_number INTEGER NOT NULL DEFAULT 0,
--     description TEXT,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     created_by VARCHAR(255) NOT NULL
-- );

-- History table structure:
-- CREATE TABLE history (
--     event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     room_id VARCHAR(16) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
--     turn_number INTEGER NOT NULL,
--     role_id VARCHAR(100) NOT NULL,
--     action_id VARCHAR(100) NOT NULL,
--     action_params JSONB,
--     timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
--     description TEXT
-- );

