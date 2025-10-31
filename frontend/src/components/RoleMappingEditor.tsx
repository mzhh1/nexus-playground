/**
 * Role Mapping Editor
 * Simple role mapping interface for M0
 */

import React, { useState, useEffect } from 'react';
import type { PlayerList, RoleMapping } from '../lib/types';
import '../styles/role-mapping.module.css';

interface RoleMappingEditorProps {
  playerList: PlayerList;
  roleIds: string[];
  initialMapping?: RoleMapping;
  onMappingChange?: (mapping: RoleMapping) => void;
}

const formatRoleLabel = (roleId: string): string => {
  if (roleId.startsWith('player_')) {
    const suffix = roleId.slice('player_'.length);
    return `Player ${suffix.toUpperCase()}`;
  }

  return roleId;
};

export const RoleMappingEditor: React.FC<RoleMappingEditorProps> = ({
  playerList,
  roleIds,
  initialMapping = {},
  onMappingChange,
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
    onMappingChange?.(newMapping);
  };

  const getAssignedRoles = (playerId: string): string[] => {
    return Object.entries(mapping)
      .filter(([_, pid]) => pid === playerId)
      .map(([roleId]) => roleId);
  };

  const playerOptions = Object.entries(playerList);

  return (
    <div className="role-mapping-editor">
      <h3>Role Assignment</h3>
      <p className="help-text">
        Assign players to game roles. Each role must have exactly one player.
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
        <h4>Player Assignment</h4>
        {playerOptions.length === 0 && (
          <p className="empty-message">No players available</p>
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
                <span className="no-role">Not assigned</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

