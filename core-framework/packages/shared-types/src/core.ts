/**
 * USADL 核心类型定义
 */

/**
 * 全局状态 (Global State)
 * 游戏在服务器端的唯一真实数据源（"上帝视角"）
 */
export interface GlobalState {
  /** 游戏规则的自然语言描述 */
  game_rules: string;
  
  /** 从游戏开始到当前所有已执行的行动日志 */
  history: ActionRecord[];
  
  /** 当前游戏局面的所有权威信息 */
  current_state: Record<string, any>;
  
  /** 游戏元数据 */
  metadata?: {
    game_id: string;
    created_at: string;
    updated_at: string;
  };
}

/**
 * 角色视角 (Role Perspective)
 * 根据全局状态为特定角色生成的"客户端视图"
 */
export interface RolePerspective {
  /** 游戏的核心玩法、目标和胜利/失败条件 */
  global_rules: string;
  
  /** 完整的游戏历史（为LLM提供完整决策上下文） */
  whole_history: ActionRecord[];
  
  /** 差异历史（从该角色上次行动至今的所有行动） */
  diff_history: ActionRecord[];
  
  /** 该角色视角下的游戏局面 */
  current_state: Record<string, any>;
  
  /** 当前扮演的角色和目标 */
  your_role: RoleIdentity;
  
  /** 当前可执行的动作定义 */
  action_space_definition: ActionSpace;
}

/**
 * 角色映射 (Role Mapping)
 * 定义游戏内每个逻辑角色由谁扮演
 */
export interface RoleMapping {
  [roleId: string]: RolePlayer;
}

/**
 * 角色玩家（人类或LLM）
 */
export type RolePlayer = HumanPlayer | LLMPlayer;

/**
 * 人类玩家
 */
export interface HumanPlayer {
  type: 'human';
  uid: string;
}

/**
 * LLM玩家
 */
export interface LLMPlayer {
  type: 'llm';
  model_name: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * 角色身份信息
 */
export interface RoleIdentity {
  /** 角色标识 */
  identity: string;
  
  /** 角色目标描述 */
  goal: string;
  
  /** 额外角色信息 */
  metadata?: Record<string, any>;
}

/**
 * 行动记录
 */
export interface ActionRecord {
  /** 回合数 */
  turn: number;
  
  /** 执行行动的角色ID */
  role_id: string;
  
  /** 行动标识 */
  action: string;
  
  /** 行动参数 */
  params?: Record<string, any>;
  
  /** 时间戳 */
  timestamp?: string;
}

/**
 * 行动空间定义
 */
export type ActionSpace = ExplicitActionSpace | TemplateActionSpace;

/**
 * 显式列表模式（小行动空间）
 */
export interface ExplicitActionSpace {
  type: 'explicit_list';
  actions: ActionDefinition[];
}

/**
 * 模板模式（大行动空间，如围棋）
 */
export interface TemplateActionSpace {
  type: 'template';
  templates: ActionTemplate[];
}

/**
 * 行动定义（显式列表中的一项）
 */
export interface ActionDefinition {
  action_id: string;
  description: string;
  params?: Record<string, any>;
}

/**
 * 行动模板（模板模式中的一项）
 */
export interface ActionTemplate {
  template_id: string;
  description: string;
  params_schema?: Record<string, ParamSchema>;
}

/**
 * 参数模式（用于验证LLM生成的参数）
 */
export interface ParamSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  minimum?: number;
  maximum?: number;
  enum?: any[];
  required?: boolean;
}

