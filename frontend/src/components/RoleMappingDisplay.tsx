/**
 * Role Mapping Display (Read-only)
 * Displays current role assignments without editing capability
 */

import React from 'react';
import type { PlayerList, RoleMapping } from '../lib/types';
import '../styles/role-mapping.module.css';

interface RoleMappingDisplayProps {
  playerList: PlayerList;
  roleIds: string[];
  mapping: RoleMapping;
  onEdit?: () => void;
}

const formatRoleLabel = (roleId: string): string => {
  if (roleId.startsWith('player_')) {
    const suffix = roleId.slice('player_'.length);
    return `Player ${suffix.toUpperCase()}`;
  }
  return roleId;
};

export const RoleMappingDisplay: React.FC<RoleMappingDisplayProps> = ({
  playerList,
  roleIds,
  mapping,
  onEdit,
}) => {
  const getAssignedRoles = (playerId: string): string[] => {
    return Object.entries(mapping)
      .filter(([_, pid]) => pid === playerId)
      .map(([roleId]) => roleId);
  };

  const playerOptions = Object.entries(playerList);
  const isMappingComplete = roleIds.length > 0 && roleIds.every(roleId => mapping[roleId]);

  return (
    <div className="role-mapping-editor">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-sm)' }}>
        <h3>角色分配</h3>
        {onEdit && (
          <button onClick={onEdit} className="secondary" style={{ fontSize: '0.875rem' }}>
            编辑
          </button>
        )}
      </div>

      {!isMappingComplete && (
        <p className="help-text" style={{ color: 'var(--color-warning)' }}>
          ⚠️ 还有角色未分配，请点击编辑完成分配
        </p>
      )}

      <div className="mapping-grid">
        {roleIds.map((roleId) => {
          const playerId = mapping[roleId];
          const player = playerId ? playerList[playerId] : null;
          
          return (
            <div key={roleId} className="role-row">
              <div className="role-label">
                <strong>{formatRoleLabel(roleId)}</strong>
              </div>
              
              <div className="player-display">
                {player ? (
                  <span>
                    {player.display_name} <span style={{ color: 'var(--color-text-secondary)' }}>({player.type})</span>
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                    未分配
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mapping-summary">
        <h4>玩家分配情况</h4>
        {playerOptions.length === 0 && (
          <p className="empty-message">暂无玩家</p>
        )}
        {playerOptions.map(([playerId, player]) => {
          const roles = getAssignedRoles(playerId).map((id) => formatRoleLabel(id));
          return (
            <div key={playerId} className="player-summary">
              <span className="player-name">{player.display_name}</span>
              {roles.length > 0 ? (
                <span className="assigned-roles">
                  → {roles.join(', ')}
                </span>
              ) : (
                <span className="no-role">未分配</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

