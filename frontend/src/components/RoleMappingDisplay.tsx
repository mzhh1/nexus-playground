/**
 * Role Mapping Display (Read-only)
 * Displays current role assignments without editing capability
 */

import React from 'react';
import type { RoleMapping } from '../lib/types';
import type { ClientPlayerInfo } from '../hooks/useNexusEngine';
import { RoleMappingGraph } from './RoleMappingGraph';
import '../styles/role-mapping.module.css';

interface RoleMappingDisplayProps {
  playerList: Record<string, ClientPlayerInfo>;
  roleIds: string[];
  mapping: RoleMapping;
  onEdit?: () => void;
}

export const RoleMappingDisplay: React.FC<RoleMappingDisplayProps> = ({
  playerList,
  roleIds,
  mapping,
  onEdit,
}) => {
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

      <RoleMappingGraph
        playerList={playerList}
        roleIds={roleIds}
        mapping={mapping}
        onChange={() => {}}
        readonly={true}
      />
    </div>
  );
};

