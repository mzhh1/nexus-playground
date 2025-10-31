/**
 * Role Mapping Modal
 * Modal dialog for editing role assignments
 */

import React, { useState, useEffect } from 'react';
import type { PlayerList, RoleMapping } from '../lib/types';
import '../styles/modal.css';

interface RoleMappingModalProps {
  playerList: PlayerList;
  roleIds: string[];
  initialMapping: RoleMapping;
  onSave: (mapping: RoleMapping) => void;
  onCancel: () => void;
}

const formatRoleLabel = (roleId: string): string => {
  if (roleId.startsWith('player_')) {
    const suffix = roleId.slice('player_'.length);
    return `Player ${suffix.toUpperCase()}`;
  }
  return roleId;
};

export const RoleMappingModal: React.FC<RoleMappingModalProps> = ({
  playerList,
  roleIds,
  initialMapping,
  onSave,
  onCancel,
}) => {
  const [mapping, setMapping] = useState<RoleMapping>(initialMapping);

  useEffect(() => {
    setMapping(initialMapping);
  }, [initialMapping]);

  const handleRoleAssignment = (roleId: string, playerId: string) => {
    const newMapping = { ...mapping };
    
    if (playerId === '') {
      // Unassign role
      delete newMapping[roleId];
    } else {
      // Assign role
      newMapping[roleId] = playerId;
    }

    setMapping(newMapping);
  };

  const getAssignedRoles = (playerId: string): string[] => {
    return Object.entries(mapping)
      .filter(([_, pid]) => pid === playerId)
      .map(([roleId]) => roleId);
  };

  const playerOptions = Object.entries(playerList);

  const handleSave = () => {
    onSave(mapping);
  };

  // Check if mapping is complete
  const isMappingComplete = roleIds.length > 0 && roleIds.every(roleId => mapping[roleId]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑角色分配</h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          <p className="help-text">
            为每个游戏角色分配一个玩家。所有角色都必须被分配才能开始游戏。
          </p>

          <div className="mapping-grid">
            {roleIds.map((roleId) => (
              <div key={roleId} className="role-row">
                <div className="role-label">
                  <strong>{formatRoleLabel(roleId)}</strong>
                </div>
                
                <div className="player-select">
                  <select
                    value={mapping[roleId] || ''}
                    onChange={(e) => handleRoleAssignment(roleId, e.target.value)}
                  >
                    <option value="">-- Select Player --</option>
                    {playerOptions.map(([playerId, player]) => (
                      <option key={playerId} value={playerId}>
                        {player.display_name} ({player.type})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
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

        <div className="modal-footer">
          <button className="secondary" onClick={onCancel}>
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={!isMappingComplete}
            title={!isMappingComplete ? '请分配所有角色' : ''}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

