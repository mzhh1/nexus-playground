/**
 * Role Mapping Graph
 * Visual node-and-edge graph for role-player mappings
 * Left column: Role nodes, Right column: Player nodes
 * Lines represent mappings, can be dragged, deleted, and connected
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import type { RoleMapping } from '../lib/types';
import type { ClientPlayerInfo } from '../hooks/useNexusEngine';
import { NodeCard } from './NodeCard';
import styles from './RoleMappingGraph.module.css';

interface RoleMappingGraphProps {
  playerList: Record<string, ClientPlayerInfo>;
  roleIds: string[];
  mapping: RoleMapping;
  onChange: (mapping: RoleMapping) => void;
  readonly?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  fromRoleId: string | null;
  currentPoint: Point | null;
}

const formatRoleLabel = (roleId: string): string => {
  if (roleId.startsWith('player_')) {
    const suffix = roleId.slice('player_'.length);
    return `Player ${suffix.toUpperCase()}`;
  }
  return roleId;
};

export const RoleMappingGraph: React.FC<RoleMappingGraphProps> = ({
  playerList,
  roleIds,
  mapping,
  onChange,
  readonly = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const roleCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const playerCardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    fromRoleId: null,
    currentPoint: null,
  });
  const [hoveredLine, setHoveredLine] = useState<string | null>(null);
  const [cardPositions, setCardPositions] = useState<{
    roles: Map<string, DOMRect>;
    players: Map<string, DOMRect>;
  }>({
    roles: new Map(),
    players: new Map(),
  });

  const playerIds = Object.keys(playerList);

  // Update card positions when layout changes
  const updatePositions = useCallback(() => {
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect || svgRect.width === 0 || svgRect.height === 0) return;

    const roles = new Map<string, DOMRect>();
    const players = new Map<string, DOMRect>();

    roleCardRefs.current.forEach((element, roleId) => {
      if (element) {
        const rect = element.getBoundingClientRect();
        roles.set(roleId, new DOMRect(
          rect.left - svgRect.left,
          rect.top - svgRect.top,
          rect.width,
          rect.height
        ));
      }
    });

    playerCardRefs.current.forEach((element, playerId) => {
      if (element) {
        const rect = element.getBoundingClientRect();
        players.set(playerId, new DOMRect(
          rect.left - svgRect.left,
          rect.top - svgRect.top,
          rect.width,
          rect.height
        ));
      }
    });

    setCardPositions(prev => {
      const rolesChanged = prev.roles.size !== roles.size ||
        Array.from(roles.entries()).some(([id, rect]) => {
          const prevRect = prev.roles.get(id);
          return !prevRect ||
            prevRect.left !== rect.left ||
            prevRect.top !== rect.top ||
            prevRect.width !== rect.width ||
            prevRect.height !== rect.height;
        });

      const playersChanged = prev.players.size !== players.size ||
        Array.from(players.entries()).some(([id, rect]) => {
          const prevRect = prev.players.get(id);
          return !prevRect ||
            prevRect.left !== rect.left ||
            prevRect.top !== rect.top ||
            prevRect.width !== rect.width ||
            prevRect.height !== rect.height;
        });

      if (rolesChanged || playersChanged) {
        return { roles, players };
      }
      return prev;
    });
  }, []);

  useEffect(() => {
    // Initial update
    const rafId = requestAnimationFrame(updatePositions);

    // Set up ResizeObserver to watch for container size changes 
    // (useful when component becomes visible or parent resizes)
    let resizeObserver: ResizeObserver | null = null;
    if (svgRef.current) {
      resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(updatePositions);
      });
      resizeObserver.observe(svgRef.current);
    }

    window.addEventListener('resize', updatePositions);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', updatePositions);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [updatePositions, roleIds.length, playerIds.length, mapping]);

  // Get connection points for a role and player
  const getConnectionPoints = (roleId: string, playerId: string): { start: Point; end: Point } | null => {
    const roleRect = cardPositions.roles.get(roleId);
    const playerRect = cardPositions.players.get(playerId);

    if (!roleRect || !playerRect) {
      return null;
    }

    // Start point: right edge center of role card
    const start: Point = {
      x: roleRect.left + roleRect.width,
      y: roleRect.top + roleRect.height / 2,
    };

    // End point: left edge center of player card
    const end: Point = {
      x: playerRect.left,
      y: playerRect.top + playerRect.height / 2,
    };

    return { start, end };
  };

  // Get SVG coordinates from mouse event
  const getSVGPoint = useCallback((e: React.MouseEvent<SVGSVGElement>): Point => {
    if (!svgRef.current) return { x: 0, y: 0 };

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }, []);

  // Handle starting a drag from a role node
  const handleRoleMouseDown = (roleId: string, e: React.MouseEvent) => {
    if (readonly) return;
    e.preventDefault();

    setDragState({
      isDragging: true,
      fromRoleId: roleId,
      currentPoint: getSVGPoint(e as any),
    });
  };

  // Handle mouse move during drag
  const handleSVGMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragState.isDragging || !dragState.fromRoleId) return;

    setDragState({
      ...dragState,
      currentPoint: getSVGPoint(e),
    });
  };

  // Handle mouse up - complete the connection
  const handleSVGMouseUp = () => {
    if (dragState.isDragging) {
      setDragState({
        isDragging: false,
        fromRoleId: null,
        currentPoint: null,
      });
    }
  };

  // Handle dropping on a player node
  const handlePlayerMouseUp = (playerId: string) => {
    if (!dragState.isDragging || !dragState.fromRoleId || readonly) return;

    const newMapping = { ...mapping };
    newMapping[dragState.fromRoleId] = playerId;
    onChange(newMapping);

    setDragState({
      isDragging: false,
      fromRoleId: null,
      currentPoint: null,
    });
  };

  // Handle deleting a connection
  const handleLineClick = (roleId: string, e: React.MouseEvent) => {
    if (readonly) return;
    e.stopPropagation();

    const newMapping = { ...mapping };
    delete newMapping[roleId];
    onChange(newMapping);
  };

  // Render a connection line
  const renderLine = (roleId: string, playerId: string) => {
    const points = getConnectionPoints(roleId, playerId);
    if (!points) return null;

    const { start, end } = points;
    const isHovered = hoveredLine === roleId;

    // Create a curved path
    const midX = (start.x + end.x) / 2;
    const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;

    return (
      <g key={`line-${roleId}`}>
        {/* Invisible wider line for easier clicking */}
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth="20"
          style={{ cursor: readonly ? 'default' : 'pointer' }}
          onClick={(e) => handleLineClick(roleId, e)}
          onMouseEnter={() => !readonly && setHoveredLine(roleId)}
          onMouseLeave={() => setHoveredLine(null)}
        />
        {/* Visible line */}
        <path
          d={path}
          fill="none"
          stroke={isHovered ? 'var(--color-danger)' : 'var(--color-primary)'}
          strokeWidth={isHovered ? '3' : '2'}
          style={{
            pointerEvents: 'none',
            transition: 'stroke 0.2s, stroke-width 0.2s'
          }}
        />
        {/* Delete button on hover */}
        {isHovered && !readonly && (
          <g>
            <circle
              cx={(start.x + end.x) / 2}
              cy={(start.y + end.y) / 2}
              r="12"
              fill="var(--color-danger)"
              style={{ cursor: 'pointer' }}
              onClick={(e) => handleLineClick(roleId, e)}
            />
            <text
              x={(start.x + end.x) / 2}
              y={(start.y + end.y) / 2}
              textAnchor="middle"
              dominantBaseline="central"
              fill="white"
              fontSize="16"
              fontWeight="bold"
              style={{ pointerEvents: 'none' }}
            >
              ×
            </text>
          </g>
        )}
      </g>
    );
  };

  // Render dragging line
  const renderDraggingLine = () => {
    if (!dragState.isDragging || !dragState.fromRoleId || !dragState.currentPoint) {
      return null;
    }

    const roleRect = cardPositions.roles.get(dragState.fromRoleId);
    if (!roleRect) {
      return null;
    }

    // Start point: right edge center of role card
    const start: Point = {
      x: roleRect.left + roleRect.width,
      y: roleRect.top + roleRect.height / 2,
    };

    const end = dragState.currentPoint;

    const midX = (start.x + end.x) / 2;
    const path = `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`;

    return (
      <path
        d={path}
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeDasharray="5,5"
        style={{ pointerEvents: 'none', opacity: 0.6 }}
      />
    );
  };

  return (
    <div className={styles['role-mapping-graph']}>
      {/* SVG layer for connection lines */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onMouseMove={handleSVGMouseMove}
        onMouseUp={handleSVGMouseUp}
        onMouseLeave={handleSVGMouseUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 1
        }}
      >
        {/* Render all connection lines */}
        {Object.entries(mapping).map(([roleId, playerId]) => {
          return renderLine(roleId, playerId);
        })}

        {/* Render dragging line */}
        {renderDraggingLine()}
      </svg>

      {/* HTML layer for node cards */}
      <div className={styles['graph-content']} style={{ position: 'relative', zIndex: 2 }}>
        <div className={styles['graph-columns']}>
          {/* Role nodes column (left) */}
          <div className={styles['graph-column']}>
            <div className={styles['column-header']}>角色 (Roles)</div>
            <div className={styles['nodes-container']}>
              {roleIds.map((roleId) => {
                const isSource = dragState.fromRoleId === roleId;
                const hasMapping = !!mapping[roleId];

                return (
                  <div
                    key={`role-${roleId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <NodeCard
                      ref={(el) => {
                        if (el) {
                          roleCardRefs.current.set(roleId, el);
                        } else {
                          roleCardRefs.current.delete(roleId);
                        }
                      }}
                      id={roleId}
                      label={formatRoleLabel(roleId)}
                      icon="🎭"
                      subtitle={hasMapping ? `→ ${playerList[mapping[roleId]]?.displayName}` : '未分配'}
                      variant="role"
                      isActive={isSource}
                      isMapped={hasMapping}
                      isDraggable={!readonly}
                      onMouseDown={readonly ? undefined : handleRoleMouseDown}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Player nodes column (right) */}
          <div className={styles['graph-column']}>
            <div className={styles['column-header']}>玩家 (Players)</div>
            <div className={styles['nodes-container']}>
              {playerIds.map((playerId) => {
                const player = playerList[playerId];
                const isHuman = player.type === 'human';
                const isMapped = Object.values(mapping).includes(playerId);

                return (
                  <div
                    key={`player-${playerId}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    onMouseUp={readonly ? undefined : () => handlePlayerMouseUp(playerId)}
                  >
                    <NodeCard
                      ref={(el) => {
                        if (el) {
                          playerCardRefs.current.set(playerId, el);
                        } else {
                          playerCardRefs.current.delete(playerId);
                        }
                      }}
                      id={playerId}
                      label={player.displayName}
                      icon={isHuman ? '👤' : '🤖'}
                      subtitle={isHuman ? 'Human' : `LLM (${player.modelName || 'Bot'})`}
                      variant="player"
                      isMapped={isMapped}
                      isClickable={!readonly}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!readonly && (
        <div className={styles['graph-instructions']}>
          <p>💡 点击左侧角色节后再点击想分配的玩家创建连线</p>
        </div>
      )}
    </div>
  );
};

