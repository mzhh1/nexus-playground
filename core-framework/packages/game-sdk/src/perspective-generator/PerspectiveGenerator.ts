/**
 * PerspectiveGenerator - 视角生成器
 * 
 * 根据全局状态和角色生成角色视角
 * 处理完美信息游戏和不完美信息游戏
 */

import {
  GlobalState,
  RolePerspective,
  ActionRecord,
  ActionSpace,
  RoleIdentity,
} from '@nexus/shared-types';

export interface PerspectiveFilterOptions {
  /** 是否显示完整历史 */
  showFullHistory?: boolean;
  
  /** 差异历史回溯数量 */
  diffHistoryLength?: number;
  
  /** 自定义状态过滤函数 */
  stateFilter?: (state: any, roleId: string) => any;
  
  /** 自定义历史过滤函数 */
  historyFilter?: (history: ActionRecord[], roleId: string) => ActionRecord[];
}

/**
 * 视角生成器基类
 */
export abstract class PerspectiveGenerator {
  protected options: PerspectiveFilterOptions;

  constructor(options: PerspectiveFilterOptions = {}) {
    this.options = {
      showFullHistory: options.showFullHistory ?? true,
      diffHistoryLength: options.diffHistoryLength ?? 10,
      stateFilter: options.stateFilter,
      historyFilter: options.historyFilter,
    };
  }

  /**
   * 生成角色视角
   */
  async generate(
    roleId: string,
    globalState: GlobalState
  ): Promise<RolePerspective> {
    // 1. 获取角色身份信息
    const roleIdentity = await this.getRoleIdentity(roleId, globalState);

    // 2. 过滤历史记录
    const wholeHistory = this.filterHistory(
      globalState.history,
      roleId,
      globalState
    );
    const diffHistory = this.getRecentHistory(
      wholeHistory,
      this.options.diffHistoryLength || 10
    );

    // 3. 过滤当前状态（处理不完美信息）
    const currentState = await this.filterState(
      globalState.current_state,
      roleId,
      globalState
    );

    // 4. 生成行动空间
    const actionSpace = await this.generateActionSpace(roleId, globalState);

    return {
      global_rules: globalState.game_rules,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: currentState,
      your_role: roleIdentity,
      action_space_definition: actionSpace,
    };
  }

  /**
   * 过滤历史记录（处理不完美信息游戏）
   */
  protected filterHistory(
    history: ActionRecord[],
    roleId: string,
    globalState: GlobalState
  ): ActionRecord[] {
    // 如果有自定义过滤器，使用它
    if (this.options.historyFilter) {
      return this.options.historyFilter(history, roleId);
    }

    // 默认：完美信息游戏，返回完整历史
    return [...history];
  }

  /**
   * 获取最近的历史记录
   */
  protected getRecentHistory(
    history: ActionRecord[],
    length: number
  ): ActionRecord[] {
    if (history.length <= length) {
      return history;
    }
    return history.slice(-length);
  }

  /**
   * 过滤游戏状态（处理不完美信息游戏）
   */
  protected async filterState(
    state: any,
    roleId: string,
    globalState: GlobalState
  ): Promise<any> {
    // 如果有自定义过滤器，使用它
    if (this.options.stateFilter) {
      return this.options.stateFilter(state, roleId);
    }

    // 默认：完美信息游戏，返回完整状态
    // 子类可以重写此方法实现不完美信息过滤
    return this.defaultFilterState(state, roleId, globalState);
  }

  /**
   * 默认状态过滤（完美信息游戏）
   * 子类可以重写以实现不完美信息游戏
   */
  protected defaultFilterState(
    state: any,
    roleId: string,
    globalState: GlobalState
  ): any {
    return { ...state };
  }

  // ============================================
  // 抽象方法 - 子类必须实现
  // ============================================

  /**
   * 获取角色身份信息
   */
  protected abstract getRoleIdentity(
    roleId: string,
    globalState: GlobalState
  ): Promise<RoleIdentity> | RoleIdentity;

  /**
   * 生成行动空间
   */
  protected abstract generateActionSpace(
    roleId: string,
    globalState: GlobalState
  ): Promise<ActionSpace> | ActionSpace;
}

/**
 * 完美信息游戏视角生成器
 */
export class PerfectInformationPerspectiveGenerator extends PerspectiveGenerator {
  protected getRoleIdentity(
    roleId: string,
    globalState: GlobalState
  ): RoleIdentity {
    return {
      identity: roleId,
      goal: 'Win the game',
    };
  }

  protected generateActionSpace(
    roleId: string,
    globalState: GlobalState
  ): ActionSpace {
    // 默认返回空的显式列表，游戏逻辑应该重写此方法
    return {
      type: 'explicit_list',
      actions: [],
    };
  }
}

/**
 * 不完美信息游戏视角生成器
 */
export class ImperfectInformationPerspectiveGenerator extends PerspectiveGenerator {
  /**
   * 过滤不可见的信息
   */
  protected override defaultFilterState(
    state: any,
    roleId: string,
    globalState: GlobalState
  ): any {
    // 子类必须实现具体的过滤逻辑
    throw new Error(
      'ImperfectInformationPerspectiveGenerator must implement filterState'
    );
  }

  protected getRoleIdentity(
    roleId: string,
    globalState: GlobalState
  ): RoleIdentity {
    return {
      identity: roleId,
      goal: 'Win the game',
    };
  }

  protected generateActionSpace(
    roleId: string,
    globalState: GlobalState
  ): ActionSpace {
    return {
      type: 'explicit_list',
      actions: [],
    };
  }
}

