/**
 * ActionPanel - 行动面板组件
 */

import React from 'react';
import { ActionSpace, ActionDefinition, ActionTemplate } from '@nexus/shared-types';

export interface ActionPanelProps {
  actionSpace: ActionSpace;
  onActionSelect: (actionId: string, params?: Record<string, any>) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * 行动面板组件
 */
export function ActionPanel({
  actionSpace,
  onActionSelect,
  disabled = false,
  className = '',
}: ActionPanelProps) {
  if (actionSpace.type === 'explicit_list') {
    return (
      <div className={`action-panel ${className}`}>
        <h3>Available Actions</h3>
        <div className="action-list">
          {actionSpace.actions.map((action: ActionDefinition) => (
            <button
              key={action.action_id}
              onClick={() => onActionSelect(action.action_id, action.params)}
              disabled={disabled}
              className="action-button"
            >
              {action.description || action.action_id}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (actionSpace.type === 'template') {
    return (
      <div className={`action-panel ${className}`}>
        <h3>Action Templates</h3>
        <div className="action-list">
          {actionSpace.templates.map((template: ActionTemplate) => (
            <div key={template.template_id} className="action-template">
              <h4>{template.description || template.template_id}</h4>
              {template.params_schema && (
                <div className="template-params">
                  <p>Parameters: {JSON.stringify(template.params_schema)}</p>
                </div>
              )}
              <button
                onClick={() => onActionSelect(template.template_id)}
                disabled={disabled}
                className="action-button"
              >
                Use Template
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

