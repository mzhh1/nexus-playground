/**
 * GameLoop - 游戏循环模板基类
 * 
 * 提供标准化的回合制游戏流程框架
 * 游戏开发者继承此类并实现钩子方法
 */

import {
  GlobalState,
  RolePerspective,
  RoleMapping,
  PlayerAction,
  ActionValidationResult,
  ActionExecutionResult,
  GameResult,
  GameConfig,
} from '@nexus/shared-types';
import { StateManager } from '../state-manager';
import { EventBus } from '../event-bus';

export interface GameLoopOptions {
  /** 游戏配置 */
  config: GameConfig;
  
  /** 初始全局状态 */
  initialState: GlobalState;
  
  /** 角色映射 */
  roleMapping: RoleMapping;
  
  /** 状态管理器选项 */
  stateManagerOptions?: any;
  
  /** 事件总线选项 */
  eventBusOptions?: any;
}

/**
 * 游戏循环抽象基类
 */
export abstract class GameLoop {
  protected stateManager: StateManager;
  protected eventBus: EventBus;
  protected config: GameConfig;
  protected roleMapping: RoleMapping;
  protected isGameStarted: boolean = false;
  protected isGameEnded: boolean = false;

  constructor(options: GameLoopOptions) {
    this.config = options.config;
    this.roleMapping = options.roleMapping;
    this.stateManager = new StateManager(
      options.initialState,
      options.stateManagerOptions
    );
    this.eventBus = new EventBus(options.eventBusOptions);
  }

  /**
   * 启动游戏
   */
  async start(): Promise<void> {
    if (this.isGameStarted) {
      throw new Error('Game already started');
    }

    this.isGameStarted = true;
    await this.eventBus.emit('game:start', {
      config: this.config,
      roleMapping: this.roleMapping,
    });

    try {
      await this.onGameStart();
      await this.eventBus.emit('game:started', {
        initialState: this.stateManager.getState(),
      });
    } catch (error) {
      await this.eventBus.emit('game:error', {
        error,
        phase: 'start',
      });
      throw error;
    }
  }

  /**
   * 执行玩家行动
   */
  async executeAction(action: PlayerAction): Promise<ActionExecutionResult> {
    if (!this.isGameStarted) {
      return {
        success: false,
        error: 'Game not started',
      };
    }

    if (this.isGameEnded) {
      return {
        success: false,
        error: 'Game already ended',
      };
    }

    // 1. 验证行动
    const validation = await this.validateAction(action);
    if (!validation.valid) {
      await this.eventBus.emit('action:invalid', {
        action,
        validation,
      });
      return {
        success: false,
        error: validation.error,
      };
    }

    // 2. 回合开始钩子
    await this.onTurnStart(action.role_id);

    // 3. 执行行动
    try {
      const result = await this.handleAction(action);

      if (result.success) {
        // 更新状态
        if (result.newGlobalState) {
          this.stateManager.setState(result.newGlobalState);
        }

        // 记录行动到历史
        this.stateManager.addActionToHistory({
          turn: this.getCurrentTurn(),
          role_id: action.role_id,
          action: action.action_id,
          params: action.params,
          timestamp: new Date().toISOString(),
        });

        // 触发事件
        await this.eventBus.emit('action:executed', {
          action,
          result,
        });

        // 处理行动产生的事件
        if (result.events) {
          for (const event of result.events) {
            await this.eventBus.emit(`game:${event.type}`, event.data);
          }
        }

        // 4. 回合结束钩子
        await this.onTurnEnd(action.role_id);

        // 5. 检查游戏结束条件
        const gameResult = await this.checkGameEnd();
        if (gameResult) {
          await this.endGame(gameResult);
          return {
            ...result,
            gameEnded: true,
            gameResult,
          };
        }
      }

      return result;
    } catch (error) {
      await this.eventBus.emit('action:error', {
        action,
        error,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * 生成角色视角
   */
  async generatePerspective(roleId: string): Promise<RolePerspective> {
    const globalState = this.stateManager.getState();
    return await this.onGeneratePerspective(roleId, globalState);
  }

  /**
   * 获取当前游戏状态
   */
  getGlobalState(): Readonly<GlobalState> {
    return this.stateManager.getState();
  }

  /**
   * 获取角色映射
   */
  getRoleMapping(): Readonly<RoleMapping> {
    return { ...this.roleMapping };
  }

  /**
   * 获取游戏配置
   */
  getConfig(): Readonly<GameConfig> {
    return { ...this.config };
  }

  /**
   * 获取事件总线（用于订阅游戏事件）
   */
  getEventBus(): EventBus {
    return this.eventBus;
  }

  /**
   * 检查游戏是否已开始
   */
  isStarted(): boolean {
    return this.isGameStarted;
  }

  /**
   * 检查游戏是否已结束
   */
  isEnded(): boolean {
    return this.isGameEnded;
  }

  /**
   * 结束游戏
   */
  private async endGame(result: GameResult): Promise<void> {
    if (this.isGameEnded) {
      return;
    }

    this.isGameEnded = true;

    await this.onGameEnd(result);
    await this.eventBus.emit('game:ended', {
      result,
      finalState: this.stateManager.getState(),
    });
  }

  /**
   * 获取当前回合数
   */
  protected getCurrentTurn(): number {
    const history = this.stateManager.getHistory();
    return history.length + 1;
  }

  // ============================================
  // 抽象方法 - 子类必须实现
  // ============================================

  /**
   * 游戏开始时调用
   */
  protected abstract onGameStart(): Promise<void> | void;

  /**
   * 回合开始时调用
   */
  protected abstract onTurnStart(roleId: string): Promise<void> | void;

  /**
   * 处理玩家行动
   */
  protected abstract handleAction(
    action: PlayerAction
  ): Promise<ActionExecutionResult>;

  /**
   * 验证行动合法性
   */
  protected abstract validateAction(
    action: PlayerAction
  ): Promise<ActionValidationResult> | ActionValidationResult;

  /**
   * 生成角色视角
   */
  protected abstract onGeneratePerspective(
    roleId: string,
    globalState: GlobalState
  ): Promise<RolePerspective> | RolePerspective;

  /**
   * 检查游戏结束条件
   */
  protected abstract checkGameEnd(): Promise<GameResult | null> | GameResult | null;

  /**
   * 回合结束时调用
   */
  protected abstract onTurnEnd(roleId: string): Promise<void> | void;

  /**
   * 游戏结束时调用
   */
  protected abstract onGameEnd(result: GameResult): Promise<void> | void;
}

