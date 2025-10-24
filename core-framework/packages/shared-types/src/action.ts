/**
 * 行动相关类型定义
 */

/**
 * 玩家行动（客户端提交）
 */
export interface PlayerAction {
  /** 行动标识 */
  action_id: string;
  
  /** 行动参数 */
  params?: Record<string, any>;
  
  /** 执行行动的角色ID */
  role_id: string;
  
  /** 提交时间戳 */
  timestamp?: string;
}

/**
 * 行动验证结果
 */
export interface ActionValidationResult {
  /** 是否合法 */
  valid: boolean;
  
  /** 错误信息（如果不合法） */
  error?: string;
  
  /** 错误代码 */
  errorCode?: string;
  
  /** 建议的合法行动 */
  suggestions?: string[];
}

/**
 * 行动执行结果
 */
export interface ActionExecutionResult {
  /** 是否成功 */
  success: boolean;
  
  /** 新的全局状态（如果成功） */
  newGlobalState?: any;
  
  /** 错误信息（如果失败） */
  error?: string;
  
  /** 触发的事件列表 */
  events?: ActionEvent[];
  
  /** 游戏是否结束 */
  gameEnded?: boolean;
  
  /** 游戏结果（如果结束） */
  gameResult?: any;
}

/**
 * 行动事件（行动执行后产生的事件）
 */
export interface ActionEvent {
  /** 事件类型 */
  type: string;
  
  /** 事件描述 */
  description: string;
  
  /** 事件数据 */
  data?: Record<string, any>;
  
  /** 可见给哪些角色 */
  visibleTo?: string[] | 'all';
}

