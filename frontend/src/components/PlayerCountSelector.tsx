/**
 * Role Template Selector Component
 * 角色模板选择器 - 用于多人数配置游戏的人数选择
 */

import React from 'react';
import '../styles/player-count-selector.css';

interface RoleTemplateSelectorProps {
  /**
   * 可用的人数选项
   */
  availableCounts: number[];
  
  /**
   * 当前选择的人数
   */
  selectedCount: number | null;
  
  /**
   * 人数描述标签（可选）
   * 例如: { 6: '6人标准局', 8: '8人进阶局' }
   */
  playerCountLabels?: Record<number, string>;
  
  /**
   * 选择人数的回调
   */
  onSelect: (count: number) => void;
  
  /**
   * 是否禁用选择器
   */
  disabled?: boolean;
  
  /**
   * 是否是房主
   */
  isOwner?: boolean;
}

export const RoleTemplateSelector: React.FC<RoleTemplateSelectorProps> = ({
  availableCounts,
  selectedCount,
  playerCountLabels,
  onSelect,
  disabled = false,
  isOwner = true,
}) => {
  if (availableCounts.length === 0) {
    return null;
  }

  return (
    <div className="player-count-selector">
      <div className="selector-header">
        <p className="help-text">
          {isOwner ? '选择一个预设的角色模板' : '由房主选择角色模板'}
        </p>
      </div>
      
      <div className="count-options">
        {availableCounts.map((count) => {
          const isSelected = selectedCount === count;
          const label = playerCountLabels?.[count];
          
          return (
            <button
              key={count}
              type="button"
              className={`count-option ${isSelected ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && onSelect(count)}
              disabled={disabled}
              aria-label={`选择${count}人模式${label ? ` - ${label}` : ''}`}
              aria-pressed={isSelected}
            >
              <div className="count-number">{count}人</div>
              {label && (
                <div className="count-label">{label}</div>
              )}
              {isSelected && (
                <div className="selected-indicator">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M13.5 4.5L6 12L2.5 8.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {selectedCount && (
        <div className="selected-info">
          <span className="info-icon">✓</span>
          已选择 {selectedCount} 人模式
          {playerCountLabels?.[selectedCount] && ` - ${playerCountLabels[selectedCount]}`}
        </div>
      )}
    </div>
  );
};

// 向后兼容的别名
export const PlayerCountSelector = RoleTemplateSelector;






