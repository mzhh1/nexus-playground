/**
 * RoomManager - 房间管理器
 * 
 * 负责创建、管理和查询游戏房间
 */

import { GameConfig, Player } from '@nexus/shared-types';
import { Room, RoomOptions } from './Room';

export interface RoomFilter {
  gameId?: string;
  status?: string;
  notFull?: boolean;
  isPrivate?: boolean;
}

/**
 * 房间管理器
 */
export class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private roomIdCounter: number = 0;

  /**
   * 创建房间
   */
  createRoom(
    gameConfig: GameConfig,
    createdBy: string,
    options: RoomOptions = {}
  ): Room {
    const roomId = this.generateRoomId();
    const room = new Room(roomId, gameConfig, createdBy, options);

    this.rooms.set(roomId, room);

    return room;
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 删除房间
   */
  deleteRoom(roomId: string): boolean {
    return this.rooms.delete(roomId);
  }

  /**
   * 获取所有房间
   */
  getAllRooms(): Room[] {
    return Array.from(this.rooms.values());
  }

  /**
   * 查询房间（带过滤）
   */
  findRooms(filter: RoomFilter = {}): Room[] {
    let rooms = this.getAllRooms();

    if (filter.gameId) {
      rooms = rooms.filter((r) => r.gameConfig.id === filter.gameId);
    }

    if (filter.status) {
      rooms = rooms.filter((r) => r.getStatus() === filter.status);
    }

    if (filter.notFull) {
      rooms = rooms.filter((r) => !r.isFull());
    }

    if (filter.isPrivate !== undefined) {
      rooms = rooms.filter((r) => r.options.isPrivate === filter.isPrivate);
    }

    return rooms;
  }

  /**
   * 查找玩家所在的房间
   */
  findPlayerRoom(uid: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.getPlayer(uid)) {
        return room;
      }
    }
    return undefined;
  }

  /**
   * 玩家加入房间
   */
  joinRoom(
    roomId: string,
    player: Player,
    password?: string
  ): { success: boolean; error?: string; room?: Room } {
    const room = this.getRoom(roomId);

    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (!room.canJoin(password)) {
      return { success: false, error: 'Cannot join room' };
    }

    const added = room.addPlayer(player);

    if (!added) {
      return { success: false, error: 'Failed to add player to room' };
    }

    return { success: true, room };
  }

  /**
   * 玩家离开房间
   */
  leaveRoom(roomId: string, uid: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) {
      return false;
    }

    const removed = room.removePlayer(uid);

    // 如果房间空了，删除房间
    if (room.getPlayers().length === 0) {
      this.deleteRoom(roomId);
    }

    return removed;
  }

  /**
   * 设置玩家准备状态
   */
  setPlayerReady(roomId: string, uid: string, ready: boolean): boolean {
    const room = this.getRoom(roomId);
    if (!room) {
      return false;
    }

    return room.setPlayerReady(uid, ready);
  }

  /**
   * 清理空房间和长时间未活动的房间
   */
  cleanup(maxIdleTime: number = 3600000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      const createdAt = new Date(room.createdAt).getTime();
      const idleTime = now - createdAt;

      // 删除空房间或长时间未活动的房间
      if (
        room.getPlayers().length === 0 ||
        (room.getStatus() === 'waiting' && idleTime > maxIdleTime)
      ) {
        this.rooms.delete(roomId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * 获取房间统计信息
   */
  getStats(): {
    totalRooms: number;
    waitingRooms: number;
    playingRooms: number;
    totalPlayers: number;
  } {
    let waitingRooms = 0;
    let playingRooms = 0;
    let totalPlayers = 0;

    for (const room of this.rooms.values()) {
      totalPlayers += room.getPlayers().length;

      const status = room.getStatus();
      if (status === 'waiting') {
        waitingRooms++;
      } else if (status === 'playing') {
        playingRooms++;
      }
    }

    return {
      totalRooms: this.rooms.size,
      waitingRooms,
      playingRooms,
      totalPlayers,
    };
  }

  /**
   * 生成房间ID
   */
  private generateRoomId(): string {
    this.roomIdCounter++;
    return `room_${Date.now()}_${this.roomIdCounter}`;
  }
}

/**
 * 创建房间管理器实例
 */
export function createRoomManager(): RoomManager {
  return new RoomManager();
}

