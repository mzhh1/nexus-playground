/**
 * Role Mapping Modal
 * Modal dialog for editing role assignments
 */

import React, { useState, useEffect } from 'react';
import type { RoleMapping } from '../lib/types';
import type { EnginePlayer } from './RoleMappingGraph';
import { PlayerCountSelector } from './PlayerCountSelector';
import { RoleMappingGraph } from './RoleMappingGraph';
import '../styles/modal.css';

interface RoleMappingModalProps {
  players: Record<string, EnginePlayer>;  // Engine lobbyState.players (OAuth userId -> info)
  roleIds: string[];
  initialMapping: RoleMapping;
  onSave: (mapping: RoleMapping, selectedPlayerCount?: number) => void;
  onCancel: () => void;

  // 多人数配置相关（可选）
  isMultiPlayerCountGame?: boolean;
  availablePlayerCounts?: number[];
  initialPlayerCount?: number | null;
  onPlayerCountChange?: (count: number) => void;
  playerCountLabels?: Record<number, string>;
}

/**
 * 生成自动映射：将前n个玩家自动分配到前n个角色
 * n = min(玩家数量, 角色数量)
 */
const generateAutoMapping = (players: Record<string, EnginePlayer>, roleIds: string[]): RoleMapping => {
  const playerIds = Object.keys(players);
  const n = Math.min(playerIds.length, roleIds.length);

  const autoMapping: RoleMapping = {};
  for (let i = 0; i < n; i++) {
    autoMapping[roleIds[i]] = playerIds[i];
  }

  return autoMapping;
};

/**
 * 生成随机映射：将前n个玩家随机分配到前n个角色
 * n = min(玩家数量, 角色数量)
 */
const generateRandomMapping = (players: Record<string, EnginePlayer>, roleIds: string[]): RoleMapping => {
  const playerIds = Object.keys(players);
  const n = Math.min(playerIds.length, roleIds.length);

  // 取前n个玩家和角色
  const selectedPlayerIds = playerIds.slice(0, n);
  const selectedRoleIds = roleIds.slice(0, n);

  // 随机打乱玩家和角色
  const shuffledPlayers = [...selectedPlayerIds].sort(() => Math.random() - 0.5);
  const shuffledRoles = [...selectedRoleIds].sort(() => Math.random() - 0.5);

  const randomMapping: RoleMapping = {};
  for (let i = 0; i < n; i++) {
    randomMapping[shuffledRoles[i]] = shuffledPlayers[i];
  }

  return randomMapping;
};

export const RoleMappingModal: React.FC<RoleMappingModalProps> = ({
  players,
  roleIds,
  initialMapping,
  onSave,
  onCancel,
  isMultiPlayerCountGame = false,
  availablePlayerCounts = [],
  initialPlayerCount = null,
  onPlayerCountChange,
  playerCountLabels,
}) => {
  const [mapping, setMapping] = useState<RoleMapping>(initialMapping);
  const [selectedPlayerCount, setSelectedPlayerCount] = useState<number | null>(initialPlayerCount);

  // 当 initialMapping 变化时更新映射，如果为空则自动填充
  useEffect(() => {
    if (Object.keys(initialMapping).length === 0 && roleIds.length > 0) {
      // 如果初始映射为空，自动生成映射
      const autoMapping = generateAutoMapping(players, roleIds);
      setMapping(autoMapping);
    } else {
      setMapping(initialMapping);
    }
  }, [initialMapping, players, roleIds]);

  useEffect(() => {
    setSelectedPlayerCount(initialPlayerCount);
  }, [initialPlayerCount]);

  const handlePlayerCountSelect = (count: number) => {
    setSelectedPlayerCount(count);
    // 清空现有的角色映射（因为角色列表变了）
    // 注意：这里先设置为空，onPlayerCountChange 会触发 roleIds 变化，
    // 然后在 useEffect 中会自动填充新的映射
    setMapping({});
    onPlayerCountChange?.(count);
  };

  // 当角色列表变化时，如果映射为空，自动生成映射
  useEffect(() => {
    if (Object.keys(mapping).length === 0 && roleIds.length > 0) {
      const autoMapping = generateAutoMapping(players, roleIds);
      setMapping(autoMapping);
    }
  }, [roleIds, players]);

  const handleRandomAssign = () => {
    const randomMapping = generateRandomMapping(players, roleIds);
    setMapping(randomMapping);
  };

  const handleSave = () => {
    onSave(mapping, selectedPlayerCount ?? undefined);
  };

  // Check if mapping is complete
  const isMappingComplete = roleIds.length > 0 && roleIds.every(roleId => mapping[roleId]);

  // 对于多人数配置游戏，必须先选择人数
  const canShowRoleMapping = !isMultiPlayerCountGame || selectedPlayerCount !== null;

  // 保存按钮是否可用
  const canSave = canShowRoleMapping && isMappingComplete;

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
          {/* 人数选择器（仅多人数配置游戏显示） */}
          {isMultiPlayerCountGame && (
            <PlayerCountSelector
              availableCounts={availablePlayerCounts}
              selectedCount={selectedPlayerCount}
              playerCountLabels={playerCountLabels}
              onSelect={handlePlayerCountSelect}
            />
          )}

          {/* 角色映射配置（选择人数后或传统游戏直接显示） */}
          {canShowRoleMapping && (
            <>
              <p className="help-text">
                从左侧角色节点拖动连线到右侧玩家节点来分配角色。所有角色都必须被分配才能开始游戏。
              </p>

              <div style={{ marginBottom: 'var(--spacing-md)' }}>
                <button
                  onClick={handleRandomAssign}
                  className="secondary"
                  style={{ width: '100%' }}
                >
                  随机分配
                </button>
              </div>

              <RoleMappingGraph
                players={players}
                roleIds={roleIds}
                mapping={mapping}
                onChange={setMapping}
                readonly={false}
              />
            </>
          )}

          {/* 提示：需要先选择人数 */}
          {isMultiPlayerCountGame && !canShowRoleMapping && (
            <div className="help-text" style={{
              textAlign: 'center',
              padding: 'var(--spacing-lg)',
              color: 'var(--color-text-secondary)'
            }}>
              👆 请先选择游戏人数，然后配置角色映射
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onCancel}>
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            title={
              !canShowRoleMapping
                ? '请先选择游戏人数'
                : !isMappingComplete
                  ? '请分配所有角色'
                  : ''
            }
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

