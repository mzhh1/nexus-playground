/**
 * @nexus/game-sdk - ActionPanel Component
 * A panel for displaying and triggering game actions
 */

import React, { useState, useCallback } from 'react';
import type { ActionDefinition } from '../types';

export interface ActionPanelProps {
    /** Available actions */
    actions: ActionDefinition[];
    /** Callback when an action is triggered */
    onAction: (actionId: string, params?: Record<string, unknown>) => void;
    /** Disable all actions */
    disabled?: boolean;
    /** Additional CSS class */
    className?: string;
}

export interface ActionButtonProps {
    /** Action definition */
    definition: ActionDefinition;
    /** Click handler */
    onClick: (params?: Record<string, unknown>) => void;
    /** Is button disabled? */
    disabled?: boolean;
}

/**
 * Individual action button
 */
export const ActionButton: React.FC<ActionButtonProps> = ({
    definition,
    onClick,
    disabled = false,
}) => {
    const [params, setParams] = useState<Record<string, unknown>>({});
    const hasParams = definition.params_schema && Object.keys(definition.params_schema).length > 0;

    const handleClick = useCallback(() => {
        if (hasParams) {
            onClick(params);
        } else {
            onClick();
        }
    }, [hasParams, onClick, params]);

    const handleParamChange = useCallback((key: string, value: unknown) => {
        setParams((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Simple action without parameters
    if (!hasParams) {
        return (
            <button
                className="nexus-sdk-action-button"
                onClick={handleClick}
                disabled={disabled}
                title={definition.description}
            >
                {definition.action_id}
            </button>
        );
    }

    // Action with parameters - render inline inputs
    return (
        <div className="nexus-sdk-action-with-params">
            <span className="nexus-sdk-action-label">{definition.action_id}</span>
            {Object.entries(definition.params_schema!).map(([key, schema]) => (
                <input
                    key={key}
                    type={schema.type === 'number' || schema.type === 'integer' ? 'number' : 'text'}
                    placeholder={key}
                    title={schema.description}
                    min={schema.minimum}
                    max={schema.maximum}
                    onChange={(e) => {
                        const value =
                            schema.type === 'number' || schema.type === 'integer'
                                ? Number(e.target.value)
                                : e.target.value;
                        handleParamChange(key, value);
                    }}
                    disabled={disabled}
                    className="nexus-sdk-action-input"
                />
            ))}
            <button
                className="nexus-sdk-action-button"
                onClick={handleClick}
                disabled={disabled}
            >
                Go
            </button>
        </div>
    );
};

/**
 * Action panel component for displaying available game actions
 */
export const ActionPanel: React.FC<ActionPanelProps> = ({
    actions,
    onAction,
    disabled = false,
    className = '',
}) => {
    const handleAction = useCallback(
        (actionId: string, params?: Record<string, unknown>) => {
            onAction(actionId, params);
        },
        [onAction]
    );

    if (actions.length === 0) {
        return null;
    }

    return (
        <div data-nexus-sdk className={`nexus-sdk-action-panel ${className}`}>
            {actions.map((action) => (
                <ActionButton
                    key={action.action_id}
                    definition={action}
                    onClick={(params) => handleAction(action.action_id, params)}
                    disabled={disabled}
                />
            ))}
        </div>
    );
};
