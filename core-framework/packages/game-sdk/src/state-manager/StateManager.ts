/**
 * StateManager - 统一状态管理器
 * 
 * 负责管理游戏的全局状态，提供状态快照、历史回溯等功能
 */

import { GlobalState, ActionRecord } from '@nexus/shared-types';

export interface StateSnapshot {
  state: GlobalState;
  timestamp: string;
  version: number;
}

export interface StateManagerOptions {
  /** 是否启用历史记录 */
  enableHistory?: boolean;
  
  /** 最大历史记录数量 */
  maxHistorySize?: number;
  
  /** 是否启用快照 */
  enableSnapshots?: boolean;
  
  /** 快照间隔（回合数） */
  snapshotInterval?: number;
}

/**
 * 状态管理器
 */
export class StateManager {
  private currentState: GlobalState;
  private stateHistory: StateSnapshot[] = [];
  private options: Required<StateManagerOptions>;
  private currentVersion: number = 0;

  constructor(initialState: GlobalState, options: StateManagerOptions = {}) {
    this.currentState = this.deepClone(initialState);
    this.options = {
      enableHistory: options.enableHistory ?? true,
      maxHistorySize: options.maxHistorySize ?? 100,
      enableSnapshots: options.enableSnapshots ?? true,
      snapshotInterval: options.snapshotInterval ?? 10,
    };

    // 保存初始快照
    if (this.options.enableSnapshots) {
      this.saveSnapshot();
    }
  }

  /**
   * 获取当前状态（只读副本）
   */
  getState(): Readonly<GlobalState> {
    return this.deepClone(this.currentState);
  }

  /**
   * 更新状态
   */
  setState(newState: GlobalState): void {
    this.currentState = this.deepClone(newState);
    this.currentVersion++;

    // 保存快照（根据间隔）
    if (
      this.options.enableSnapshots &&
      this.currentVersion % this.options.snapshotInterval === 0
    ) {
      this.saveSnapshot();
    }
  }

  /**
   * 部分更新状态
   */
  updateState(updates: Partial<GlobalState>): void {
    this.currentState = {
      ...this.currentState,
      ...updates,
      current_state: {
        ...this.currentState.current_state,
        ...(updates.current_state || {}),
      },
    };
    this.currentVersion++;
  }

  /**
   * 添加行动记录到历史
   */
  addActionToHistory(action: ActionRecord): void {
    this.currentState.history.push(action);
  }

  /**
   * 获取历史记录
   */
  getHistory(): readonly ActionRecord[] {
    return [...this.currentState.history];
  }

  /**
   * 获取最近N个行动
   */
  getRecentActions(count: number): readonly ActionRecord[] {
    const history = this.currentState.history;
    return history.slice(Math.max(0, history.length - count));
  }

  /**
   * 保存当前状态快照
   */
  private saveSnapshot(): void {
    const snapshot: StateSnapshot = {
      state: this.deepClone(this.currentState),
      timestamp: new Date().toISOString(),
      version: this.currentVersion,
    };

    this.stateHistory.push(snapshot);

    // 限制历史记录大小
    if (
      this.options.maxHistorySize > 0 &&
      this.stateHistory.length > this.options.maxHistorySize
    ) {
      this.stateHistory.shift();
    }
  }

  /**
   * 获取所有快照
   */
  getSnapshots(): readonly StateSnapshot[] {
    return [...this.stateHistory];
  }

  /**
   * 回溯到指定版本
   */
  revertToVersion(version: number): boolean {
    const snapshot = this.stateHistory.find((s) => s.version === version);
    if (!snapshot) {
      return false;
    }

    this.currentState = this.deepClone(snapshot.state);
    this.currentVersion = version;
    return true;
  }

  /**
   * 回溯到指定快照
   */
  revertToSnapshot(timestamp: string): boolean {
    const snapshot = this.stateHistory.find((s) => s.timestamp === timestamp);
    if (!snapshot) {
      return false;
    }

    this.currentState = this.deepClone(snapshot.state);
    this.currentVersion = snapshot.version;
    return true;
  }

  /**
   * 获取当前版本号
   */
  getCurrentVersion(): number {
    return this.currentVersion;
  }

  /**
   * 清空历史记录（保留当前状态）
   */
  clearHistory(): void {
    this.stateHistory = [];
    if (this.options.enableSnapshots) {
      this.saveSnapshot();
    }
  }

  /**
   * 深度克隆对象
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }

  /**
   * 导出状态（用于持久化）
   */
  export(): {
    state: GlobalState;
    version: number;
    snapshots: StateSnapshot[];
  } {
    return {
      state: this.deepClone(this.currentState),
      version: this.currentVersion,
      snapshots: this.deepClone(this.stateHistory),
    };
  }

  /**
   * 从导出数据导入状态
   */
  import(data: {
    state: GlobalState;
    version: number;
    snapshots?: StateSnapshot[];
  }): void {
    this.currentState = this.deepClone(data.state);
    this.currentVersion = data.version;
    if (data.snapshots) {
      this.stateHistory = this.deepClone(data.snapshots);
    }
  }
}

