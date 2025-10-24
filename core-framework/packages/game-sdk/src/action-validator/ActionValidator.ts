/**
 * ActionValidator - 行动验证器
 * 
 * 验证玩家提交的行动是否合法
 */

import {
  PlayerAction,
  ActionValidationResult,
  GlobalState,
  ActionSpace,
  ActionDefinition,
  ActionTemplate,
} from '@nexus/shared-types';

export interface ValidationRule {
  name: string;
  validate: (
    action: PlayerAction,
    globalState: GlobalState
  ) => boolean | Promise<boolean>;
  errorMessage: string;
}

/**
 * 行动验证器基类
 */
export abstract class ActionValidator {
  protected customRules: ValidationRule[] = [];

  /**
   * 添加自定义验证规则
   */
  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  /**
   * 验证行动
   */
  async validate(
    action: PlayerAction,
    globalState: GlobalState,
    actionSpace: ActionSpace
  ): Promise<ActionValidationResult> {
    // 1. 基础验证
    const basicValidation = this.validateBasic(action);
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // 2. 验证行动是否在行动空间中
    const spaceValidation = this.validateActionSpace(action, actionSpace);
    if (!spaceValidation.valid) {
      return spaceValidation;
    }

    // 3. 验证游戏规则
    const ruleValidation = await this.validateGameRules(action, globalState);
    if (!ruleValidation.valid) {
      return ruleValidation;
    }

    // 4. 执行自定义验证规则
    for (const rule of this.customRules) {
      const isValid = await rule.validate(action, globalState);
      if (!isValid) {
        return {
          valid: false,
          error: rule.errorMessage,
          errorCode: `CUSTOM_RULE_${rule.name.toUpperCase()}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * 基础验证（检查必填字段）
   */
  protected validateBasic(action: PlayerAction): ActionValidationResult {
    if (!action.action_id) {
      return {
        valid: false,
        error: 'action_id is required',
        errorCode: 'MISSING_ACTION_ID',
      };
    }

    if (!action.role_id) {
      return {
        valid: false,
        error: 'role_id is required',
        errorCode: 'MISSING_ROLE_ID',
      };
    }

    return { valid: true };
  }

  /**
   * 验证行动是否在行动空间中
   */
  protected validateActionSpace(
    action: PlayerAction,
    actionSpace: ActionSpace
  ): ActionValidationResult {
    if (actionSpace.type === 'explicit_list') {
      return this.validateExplicitList(action, actionSpace.actions);
    } else if (actionSpace.type === 'template') {
      return this.validateTemplate(action, actionSpace.templates);
    }

    return {
      valid: false,
      error: 'Unknown action space type',
      errorCode: 'INVALID_ACTION_SPACE',
    };
  }

  /**
   * 验证显式列表模式
   */
  protected validateExplicitList(
    action: PlayerAction,
    actions: ActionDefinition[]
  ): ActionValidationResult {
    const actionDef = actions.find((a) => a.action_id === action.action_id);

    if (!actionDef) {
      return {
        valid: false,
        error: `Action "${action.action_id}" not in action space`,
        errorCode: 'ACTION_NOT_ALLOWED',
        suggestions: actions.map((a) => a.action_id),
      };
    }

    return { valid: true };
  }

  /**
   * 验证模板模式
   */
  protected validateTemplate(
    action: PlayerAction,
    templates: ActionTemplate[]
  ): ActionValidationResult {
    const template = templates.find((t) => t.template_id === action.action_id);

    if (!template) {
      return {
        valid: false,
        error: `Action template "${action.action_id}" not found`,
        errorCode: 'TEMPLATE_NOT_FOUND',
        suggestions: templates.map((t) => t.template_id),
      };
    }

    // 验证参数（如果模板定义了参数模式）
    if (template.params_schema) {
      const paramValidation = this.validateParams(
        action.params || {},
        template.params_schema
      );
      if (!paramValidation.valid) {
        return paramValidation;
      }
    }

    return { valid: true };
  }

  /**
   * 验证参数
   */
  protected validateParams(
    params: Record<string, any>,
    schema: Record<string, any>
  ): ActionValidationResult {
    for (const [key, paramSchema] of Object.entries(schema)) {
      const value = params[key];

      // 检查必填参数
      if (paramSchema.required && value === undefined) {
        return {
          valid: false,
          error: `Required parameter "${key}" is missing`,
          errorCode: 'MISSING_PARAMETER',
        };
      }

      if (value !== undefined) {
        // 类型检查
        const typeValid = this.validateParamType(value, paramSchema.type);
        if (!typeValid) {
          return {
            valid: false,
            error: `Parameter "${key}" has invalid type, expected ${paramSchema.type}`,
            errorCode: 'INVALID_PARAMETER_TYPE',
          };
        }

        // 范围检查（数字类型）
        if (paramSchema.type === 'number' || paramSchema.type === 'integer') {
          if (
            paramSchema.minimum !== undefined &&
            value < paramSchema.minimum
          ) {
            return {
              valid: false,
              error: `Parameter "${key}" must be >= ${paramSchema.minimum}`,
              errorCode: 'PARAMETER_OUT_OF_RANGE',
            };
          }
          if (
            paramSchema.maximum !== undefined &&
            value > paramSchema.maximum
          ) {
            return {
              valid: false,
              error: `Parameter "${key}" must be <= ${paramSchema.maximum}`,
              errorCode: 'PARAMETER_OUT_OF_RANGE',
            };
          }
        }

        // 枚举检查
        if (paramSchema.enum && !paramSchema.enum.includes(value)) {
          return {
            valid: false,
            error: `Parameter "${key}" must be one of: ${paramSchema.enum.join(', ')}`,
            errorCode: 'INVALID_ENUM_VALUE',
          };
        }
      }
    }

    return { valid: true };
  }

  /**
   * 验证参数类型
   */
  protected validateParamType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'integer':
        return typeof value === 'number' && Number.isInteger(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      default:
        return true;
    }
  }

  // ============================================
  // 抽象方法 - 子类可以重写
  // ============================================

  /**
   * 验证游戏规则（子类实现具体游戏的规则验证）
   */
  protected abstract validateGameRules(
    action: PlayerAction,
    globalState: GlobalState
  ): Promise<ActionValidationResult> | ActionValidationResult;
}

/**
 * 默认行动验证器（仅进行基础验证）
 */
export class DefaultActionValidator extends ActionValidator {
  protected validateGameRules(
    action: PlayerAction,
    globalState: GlobalState
  ): ActionValidationResult {
    // 默认实现：不进行额外的游戏规则验证
    return { valid: true };
  }
}

