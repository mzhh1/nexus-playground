-- Migration: Add is_public column to rooms table
-- Date: 2025-10-31
-- Description: 为房间表添加 is_public 字段，用于标记房间是否公开

-- 添加 is_public 字段，默认值为 TRUE（公开）
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT TRUE;

-- 为已存在的记录设置默认值（如果字段已存在但为 NULL）
UPDATE rooms 
SET is_public = TRUE 
WHERE is_public IS NULL;

-- 添加注释
COMMENT ON COLUMN rooms.is_public IS '房间是否公开';

-- 更新 active_rooms 视图以包含 is_public 字段
-- 需要先删除再创建，因为添加列会改变视图结构
DROP VIEW IF EXISTS active_rooms;

CREATE VIEW active_rooms AS
SELECT 
    r.room_id,
    r.owner_uid,
    r.game_id,
    r.room_status,
    r.is_public,
    r.created_at,
    r.updated_at,
    COUNT(DISTINCT s.snapshot_id) as snapshot_count,
    COUNT(DISTINCT h.event_id) as action_count
FROM rooms r
LEFT JOIN snapshots s ON r.room_id = s.room_id
LEFT JOIN history h ON r.room_id = h.room_id
WHERE r.room_status IN ('open', 'playing', 'paused')
GROUP BY r.room_id, r.owner_uid, r.game_id, r.room_status, r.is_public, r.created_at, r.updated_at;

