/**
 * Room - 房间实体类
 * 
 * 表示一个游戏房间，包含游戏实例、玩家列表等信息
 */

import {
  GameInstance,
  GameConfig,
  GameStatus,
  RoleMapping,
  GlobalState,
  Player,
} from '@nexus/shared-types';

export interface RoomPlayer {
  player: Player;
  roleId: string;
  joinedAt: string;
  ready: boolean;
}

export interface RoomOptions {
  /** 房间名称 */
  name?: string;
  
  /** 是否私有房间 */
  isPrivate?: boolean;
  
  /** 房间密码（私有房间） */
  password?: string;
  
  /** 最大玩家数（覆盖游戏配置） */
  maxPlayers?: number;
  
  /** 自定义元数据 */
  metadata?: Record<string, any>;
}

/**
 * 房间类
 */
export class Room {
  public readonly id: string;
  public readonly gameConfig: GameConfig;
  public readonly options: RoomOptions;
  public readonly createdAt: string;
  public readonly createdBy: string;

  private players: Map<string, RoomPlayer> = new Map();
  private status: GameStatus = 'waiting';
  private gameInstance: GameInstance | null = null;

  constructor(
    id: string,
    gameConfig: GameConfig,
    createdBy: string,
    options: RoomOptions = {}
  ) {
    this.id = id;
    this.gameConfig = gameConfig;
    this.createdBy = createdBy;
    this.createdAt = new Date().toISOString();
    this.options = {
      name: options.name || `${gameConfig.name} Room`,
      isPrivate: options.isPrivate ?? false,
      password: options.password,
      maxPlayers: options.maxPlayers || gameConfig.maxPlayers,
      metadata: options.metadata || {},
    };
  }

  /**
   * 玩家加入房间
   */
  addPlayer(player: Player, roleId?: string): boolean {
    // 检查房间是否已满
    if (this.isFull()) {
      return false;
    }

    // 检查玩家是否已在房间中
    if (this.players.has(player.uid)) {
      return false;
    }

    // 检查游戏是否已开始
    if (this.status !== 'waiting') {
      return false;
    }

    // 分配角色ID
    const assignedRoleId = roleId || this.getNextAvailableRoleId();

    this.players.set(player.uid, {
      player,
      roleId: assignedRoleId,
      joinedAt: new Date().toISOString(),
      ready: false,
    });

    return true;
  }

  /**
   * 玩家离开房间
   */
  removePlayer(uid: string): boolean {
    return this.players.delete(uid);
  }

  /**
   * 设置玩家准备状态
   */
  setPlayerReady(uid: string, ready: boolean): boolean {
    const roomPlayer = this.players.get(uid);
    if (!roomPlayer) {
      return false;
    }

    roomPlayer.ready = ready;
    return true;
  }

  /**
   * 检查所有玩家是否准备就绪
   */
  areAllPlayersReady(): boolean {
    if (this.players.size < this.gameConfig.minPlayers) {
      return false;
    }

    for (const roomPlayer of this.players.values()) {
      if (!roomPlayer.ready) {
        return false;
      }
    }

    return true;
  }

  /**
   * 获取房间中的玩家列表
   */
  getPlayers(): RoomPlayer[] {
    return Array.from(this.players.values());
  }

  /**
   * 获取特定玩家
   */
  getPlayer(uid: string): RoomPlayer | undefined {
    return this.players.get(uid);
  }

  /**
   * 检查房间是否已满
   */
  isFull(): boolean {
    return this.players.size >= (this.options.maxPlayers || this.gameConfig.maxPlayers);
  }

  /**
   * 检查房间是否可加入
   */
  canJoin(password?: string): boolean {
    // 检查房间状态
    if (this.status !== 'waiting') {
      return false;
    }

    // 检查是否已满
    if (this.isFull()) {
      return false;
    }

    // 检查密码（私有房间）
    if (this.options.isPrivate && this.options.password !== password) {
      return false;
    }

    return true;
  }

  /**
   * 获取房间状态
   */
  getStatus(): GameStatus {
    return this.status;
  }

  /**
   * 设置房间状态
   */
  setStatus(status: GameStatus): void {
    this.status = status;
  }

  /**
   * 设置游戏实例
   */
  setGameInstance(instance: GameInstance): void {
    this.gameInstance = instance;
    this.status = 'playing';
  }

  /**
   * 获取游戏实例
   */
  getGameInstance(): GameInstance | null {
    return this.gameInstance;
  }

  /**
   * 生成角色映射
   */
  generateRoleMapping(): RoleMapping {
    const mapping: RoleMapping = {};

    for (const roomPlayer of this.players.values()) {
      mapping[roomPlayer.roleId] = {
        type: 'human',
        uid: roomPlayer.player.uid,
      };
    }

    return mapping;
  }

  /**
   * 获取下一个可用的角色ID
   */
  private getNextAvailableRoleId(): string {
    const existingRoleIds = new Set(
      Array.from(this.players.values()).map((p) => p.roleId)
    );

    // 根据游戏类型生成角色ID
    let index = 1;
    while (true) {
      const roleId = `player_${index}`;
      if (!existingRoleIds.has(roleId)) {
        return roleId;
      }
      index++;
    }
  }

  /**
   * 序列化房间信息（用于API响应）
   */
  toJSON(): any {
    return {
      id: this.id,
      name: this.options.name,
      gameId: this.gameConfig.id,
      gameName: this.gameConfig.name,
      status: this.status,
      players: this.getPlayers().map((rp) => ({
        uid: rp.player.uid,
        nickname: rp.player.nickname,
        avatar: rp.player.avatar,
        roleId: rp.roleId,
        ready: rp.ready,
        joinedAt: rp.joinedAt,
      })),
      playerCount: this.players.size,
      maxPlayers: this.options.maxPlayers,
      minPlayers: this.gameConfig.minPlayers,
      isPrivate: this.options.isPrivate,
      isFull: this.isFull(),
      createdAt: this.createdAt,
      createdBy: this.createdBy,
      metadata: this.options.metadata,
    };
  }
}

