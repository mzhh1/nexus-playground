/**
 * Node Card Component
 * Reusable card component for displaying nodes in graphs
 * Used by RoleMappingGraph and other components
 */

import React from 'react';
import styles from './NodeCard.module.css';

interface NodeCardProps {
  id: string;
  label: string;
  icon?: string;
  subtitle?: string;
  variant?: 'role' | 'player' | 'default';
  isActive?: boolean;
  isMapped?: boolean;
  isDraggable?: boolean;
  isClickable?: boolean;
  onClick?: (id: string) => void;
  onMouseDown?: (id: string, event: React.MouseEvent) => void;
  className?: string;
}

export const NodeCard = React.forwardRef<HTMLDivElement, NodeCardProps>(({
  id,
  label,
  icon,
  subtitle,
  variant = 'default',
  isActive = false,
  isMapped = false,
  isDraggable = false,
  isClickable = false,
  onClick,
  onMouseDown,
  className = '',
}, ref) => {
  const handleClick = () => {
    if (isClickable && onClick) {
      onClick(id);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDraggable && onMouseDown) {
      onMouseDown(id, e);
    }
  };

  const cardClasses = [
    styles.nodeCard,
    styles[`variant-${variant}`],
    isActive ? styles.active : '',
    isMapped ? styles.mapped : '',
    isDraggable ? styles.draggable : '',
    isClickable ? styles.clickable : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      className={cardClasses}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      data-node-id={id}
    >
      {icon && (
        <div className={styles.nodeIcon}>
          {icon}
        </div>
      )}
      
      <div className={styles.nodeInfo}>
        <div className={styles.nodeLabel}>{label}</div>
        {subtitle && (
          <div className={styles.nodeSubtitle}>{subtitle}</div>
        )}
      </div>
    </div>
  );
});

