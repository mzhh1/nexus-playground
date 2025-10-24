/**
 * 玩家相关类型定义
 */

/**
 * 玩家信息
 */
export interface Player {
  /** 用户唯一标识 */
  uid: string;
  
  /** 用户昵称 */
  nickname?: string;
  
  /** 邮箱 */
  email?: string;
  
  /** 头像URL */
  avatar?: string;
  
  /** 玩家等级 */
  level?: number;
  
  /** 积分 */
  points?: number;
  
  /** 创建时间 */
  createdAt?: string;
  
  /** 最后登录时间 */
  lastLoginAt?: string;
}

/**
 * 玩家统计
 */
export interface PlayerStats {
  /** 用户ID */
  uid: string;
  
  /** 游戏ID */
  gameId: string;
  
  /** 总局数 */
  totalGames: number;
  
  /** 获胜局数 */
  wins: number;
  
  /** 失败局数 */
  losses: number;
  
  /** 平局数 */
  draws: number;
  
  /** 胜率 */
  winRate: number;
  
  /** ELO评分（可选） */
  elo?: number;
  
  /** 最高连胜 */
  maxWinStreak?: number;
  
  /** 当前连胜 */
  currentWinStreak?: number;
}

/**
 * 玩家会话
 */
export interface PlayerSession {
  /** 会话ID */
  sessionId: string;
  
  /** 用户ID */
  uid: string;
  
  /** 当前所在房间ID */
  currentRoomId?: string;
  
  /** 在线状态 */
  online: boolean;
  
  /** 最后活跃时间 */
  lastActiveAt: string;
  
  /** WebSocket连接ID */
  socketId?: string;
}

