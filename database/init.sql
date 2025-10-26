-- Nexus Playground Database Schema
-- Version: 1.0
-- Description: PostgreSQL schema for rooms, snapshots, and game history

-- ============ Extension Setup ============
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ Rooms Table ============
-- Stores persistent room (nexus) information
CREATE TABLE IF NOT EXISTS rooms (
    room_id VARCHAR(16) PRIMARY KEY,
    owner_uid VARCHAR(255) NOT NULL,
    game_id VARCHAR(100),
    room_status VARCHAR(20) NOT NULL DEFAULT 'open', -- open, playing, paused, finished
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT unique_owner_room UNIQUE (owner_uid),
    CONSTRAINT valid_room_status CHECK (room_status IN ('open', 'playing', 'paused', 'finished'))
);

-- Index for fast lookup by owner
CREATE INDEX idx_rooms_owner_uid ON rooms(owner_uid);
CREATE INDEX idx_rooms_created_at ON rooms(created_at);

-- ============ Snapshots Table ============
-- Stores saved game states for recovery and replay
CREATE TABLE IF NOT EXISTS snapshots (
    snapshot_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(16) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    game_id VARCHAR(100) NOT NULL,
    game_state JSONB NOT NULL, -- Full authoritative game state
    turn_number INTEGER NOT NULL DEFAULT 0,
    description TEXT, -- User-provided description
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255) NOT NULL, -- User ID who created the snapshot
    
    -- Indexes
    CONSTRAINT fk_snapshot_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

CREATE INDEX idx_snapshots_room_id ON snapshots(room_id);
CREATE INDEX idx_snapshots_created_at ON snapshots(created_at);

-- ============ History Table ============
-- Stores action history for rooms (optional for M0, included for completeness)
CREATE TABLE IF NOT EXISTS history (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id VARCHAR(16) NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    turn_number INTEGER NOT NULL,
    role_id VARCHAR(100) NOT NULL,
    action_id VARCHAR(100) NOT NULL,
    action_params JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT, -- Natural language description for LLM
    
    -- Indexes
    CONSTRAINT fk_history_room FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
);

CREATE INDEX idx_history_room_id ON history(room_id);
CREATE INDEX idx_history_turn_number ON history(room_id, turn_number);
CREATE INDEX idx_history_timestamp ON history(timestamp);

-- ============ Trigger: Update timestamp ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rooms_updated_at
    BEFORE UPDATE ON rooms
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============ Sample Data (for development/testing) ============
-- Uncomment to insert sample data

-- INSERT INTO rooms (room_id, owner_uid, game_id, room_status)
-- VALUES 
--     ('ABC12345', 'test_user_1', 'tic-tac-toe', 'open'),
--     ('XYZ98765', 'test_user_2', 'tic-tac-toe', 'playing');

-- ============ Views (optional helpers) ============
-- View for active rooms
CREATE OR REPLACE VIEW active_rooms AS
SELECT 
    r.room_id,
    r.owner_uid,
    r.game_id,
    r.room_status,
    r.created_at,
    r.updated_at,
    COUNT(DISTINCT s.snapshot_id) as snapshot_count,
    COUNT(DISTINCT h.event_id) as action_count
FROM rooms r
LEFT JOIN snapshots s ON r.room_id = s.room_id
LEFT JOIN history h ON r.room_id = h.room_id
WHERE r.room_status IN ('open', 'playing', 'paused')
GROUP BY r.room_id, r.owner_uid, r.game_id, r.room_status, r.created_at, r.updated_at;

-- ============ Permissions (for production) ============
-- Grant appropriate permissions to the nexus_user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nexus_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nexus_user;
GRANT SELECT ON active_rooms TO nexus_user;

