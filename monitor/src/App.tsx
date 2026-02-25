import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AuthConfig,
  connectLogStream,
  DEFAULT_PAGE_SIZE,
  fetchInteractionGroup,
  fetchInteractions,
  getAuthConfig,
  setAuthConfig,
  fetchRoomState,
  fetchRoomPerspective,
  submitRoomAction,
  fetchBackendRooms,
  deleteBackendRoom,
} from './api';
import { GameUIContainer } from './components/GameUIContainer';
import { RoleStatusBar } from './components/RoleStatusBar';
import {
  InteractionStatus,
  LLMInteraction,
  InteractionGroupResponse,
  PlayerType,
} from './types';

const STATUS_OPTIONS: Array<{ value: '' | InteractionStatus; label: string }> = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '等待回应' },
  { value: 'retrying', label: '重试中' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
  { value: 'rejected', label: '被游戏拒绝' },
];

const STATUS_LABEL: Record<InteractionStatus, string> = {
  pending: '等待回应',
  retrying: '重试中',
  success: '成功',
  failed: '失败',
  rejected: '被游戏拒绝',
};

const STATUS_CLASS: Record<InteractionStatus, string> = {
  pending: 'badge badge--pending',
  retrying: 'badge badge--retrying',
  success: 'badge badge--success',
  failed: 'badge badge--failed',
  rejected: 'badge badge--rejected',
};

const PLAYER_TYPE_OPTIONS: Array<{ value: '' | PlayerType; label: string }> = [
  { value: '', label: '全部类型' },
  { value: 'llm', label: 'LLM' },
  { value: 'human', label: 'Human' },
];

function formatTimestamp(value: string | null, fallback = '—'): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return `${date.toLocaleString('zh-CN', {
    hour12: false,
  })}`;
}

function formatResponseTime(responseTimeMs: number | null): string {
  if (responseTimeMs == null) return '未知';
  if (responseTimeMs < 1000) return `${responseTimeMs} ms`;
  return `${(responseTimeMs / 1000).toFixed(2)} s`;
}

interface TimelineState {
  loading: boolean;
  error: string | null;
  data: InteractionGroupResponse | null;
}

function StatusBadge({ status }: { status: InteractionStatus }) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}

function AttemptChip({
  attempt,
  outerAttempt,
}: {
  attempt: number;
  outerAttempt: number;
}) {
  return (
    <span className="chip">
      尝试 {attempt} <span className="chip__sub">(外层 {outerAttempt})</span>
    </span>
  );
}

const PAGE_SIZE = DEFAULT_PAGE_SIZE;
function App() {
  const [statusFilter, setStatusFilter] = useState<'' | InteractionStatus>('');
  const [playerTypeFilter, setPlayerTypeFilter] = useState<'' | PlayerType>('');
  const [roomFilter, setRoomFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [order, setOrder] = useState<'desc' | 'asc'>('desc');
  const [interactions, setInteractions] = useState<LLMInteraction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timelineState, setTimelineState] = useState<TimelineState>({
    loading: false,
    error: null,
    data: null,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [config, setConfigState] = useState<AuthConfig | null>(getAuthConfig());
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connected' | 'disconnected'>('idle');
  const [navMode, setNavMode] = useState<'menu' | 'logs' | 'rooms' | 'backendrooms'>('menu');

  // Room View state
  const [roomSearchTerm, setRoomSearchTerm] = useState(localStorage.getItem('monitor_last_room_id') || '');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(localStorage.getItem('monitor_last_room_id'));
  const [roomState, setRoomState] = useState<any>(null);
  const [isRoomLoading, setIsRoomLoading] = useState(false);
  const [roomViewMode, setRoomViewMode] = useState<'visual' | 'raw'>('visual');

  // Role View state
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePerspective, setRolePerspective] = useState<any>(null);
  const [isRoleLoading, setIsRoleLoading] = useState(false);
  const [roleViewMode, setRoleViewMode] = useState<'visual' | 'raw'>('raw');

  // Backend Room View state
  const [backendRooms, setBackendRooms] = useState<any[]>([]);
  const [backendRoomsTotal, setBackendRoomsTotal] = useState(0);
  const [isBackendRoomsLoading, setIsBackendRoomsLoading] = useState(false);
  const [backendRoomsError, setBackendRoomsError] = useState<string | null>(null);

  const loadBackendRooms = useCallback(async () => {
    setIsBackendRoomsLoading(true);
    setBackendRoomsError(null);
    try {
      const resp = await fetchBackendRooms(50, 0); // Hardcoded limit for simplicity, pagination could be added
      setBackendRooms(resp.data);
      setBackendRoomsTotal(resp.total);
    } catch (err: any) {
      setBackendRoomsError(err.message || '加载后端房间列表失败');
    } finally {
      setIsBackendRoomsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (navMode === 'backendrooms') {
      loadBackendRooms();
    }
  }, [navMode, loadBackendRooms]);

  const handleDeleteBackendRoom = async (roomId: string) => {
    if (!window.confirm(`确定要从数据库中强制删除房间 [${roomId}] 吗？这种操作不可逆！`)) {
      return;
    }

    try {
      await deleteBackendRoom(roomId);
      loadBackendRooms(); // refresh after delete
    } catch (err: any) {
      alert(`删除失败: ${err.message}`);
    }
  };

  const RoomDetailVisual = ({ state }: { state: any }) => {
    if (!state) return null;
    const history = state.history || [];
    const playersMap = state.players || {};
    const players = Object.entries(playersMap).map(([id, p]: [string, any]) => ({ id, ...p }));
    const roleMapping = state.roleMapping || {};
    const gameConfig = state.gameConfig || {};

    return (
      <div className="room-visual">
        <section>
          <div className="section-title">📊 房间概览</div>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-card__label">Room ID</span>
              <span className="summary-card__value">{state.roomId}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">阶段</span>
              <span className={`phase-badge phase--${state.phase || 'lobby'}`}>
                {state.phase === 'lobby' ? '等待中' : state.phase === 'playing' ? '游戏中' : state.phase === 'finished' ? '已结束' : state.phase}
              </span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Game ID</span>
              <span className="summary-card__value">{gameConfig.gameId || 'Unknown'}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">State Index</span>
              <span className="summary-card__value">#{state.stateIndex}</span>
            </div>
            <div className="summary-card">
              <span className="summary-card__label">Runtime ID</span>
              <span className="summary-card__value">{state.runtimeId?.slice(0, 8)}...</span>
            </div>
          </div>
        </section>

        <section>
          <div className="section-title">🎭 角色分配 (点击进入角色视角)</div>
          <div className="role-grid">
            {Object.entries(roleMapping).map(([roleId, playerId]: [string, any]) => {
              const player = playersMap[playerId];
              return (
                <div
                  key={roleId}
                  className="role-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => loadRolePerspective(roleId)}
                >
                  <div className="role-card__header">
                    <span className="role-card__id">{roleId}</span>
                  </div>
                  <div className="role-card__player">
                    {player ? (
                      <>
                        <span>{player.type === 'llm' ? '🤖' : '👤'}</span>
                        <span style={{ fontWeight: 600 }}>{player.displayName}</span>
                        <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>({playerId.slice(0, 8)})</span>
                      </>
                    ) : (
                      <span className="role-card__unassigned">已分配给离线/未知玩家: {playerId}</span>
                    )}
                  </div>
                </div>
              );
            })}
            {Object.keys(roleMapping).length === 0 && <div className="empty-state">暂无角色分配</div>}
          </div>
        </section>

        <section>
          <div className="section-title">👥 在线玩家 ({players.length})</div>
          <div className="player-grid">
            {players.map((p: any) => (
              <div key={p.id} className="player-card">
                <div className={`player-card__avatar ${p.type === 'llm' ? 'player-card__avatar--llm' : ''}`}>
                  {p.type === 'llm' ? '🤖' : '👤'}
                </div>
                <div className="player-card__info">
                  <div className="player-card__name">
                    {p.displayName || p.id.slice(0, 8)}
                    <span className={`player-card__status ${!p.connected ? 'player-card__status--offline' : ''}`} />
                  </div>
                  <div style={{ fontSize: '0.8rem', opacity: 0.6 }}>{p.id}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title">📜 行动历史 ({history.length})</div>
          <div className="history-list">
            {history.slice(-10).reverse().map((h: any, i: number) => (
              <div key={i} className="history-item">
                <span className="history-item__time">{new Date(h.timestamp || Date.now()).toLocaleTimeString()}</span>
                <span className="history-item__role">{h.roleId || 'System'}</span>
                <div className="history-item__action">
                  <span className="history-item__id" style={{ background: 'rgba(99, 102, 241, 0.2)', padding: '0.2rem 0.4rem', borderRadius: '0.3rem', marginRight: '0.5rem', fontSize: '0.8rem' }}>
                    ID: {h.action?.action_id || h.actionId || 'N/A'}
                  </span>
                  <span style={{ color: '#94a3b8' }}>Params:</span> {typeof (h.action?.params || h.params) === 'object' ? JSON.stringify(h.action?.params || h.params) : h.action?.params || h.params}
                </div>
              </div>
            ))}
            {history.length === 0 && <div className="empty-state">暂无行动历史数据</div>}
          </div>
        </section>

        <section>
          <div className="section-title">🎮 游戏状态 (Game State)</div>
          <div className="game-state-container">
            <div className="game-state-header">
              <span className="game-state-header__title">Prettified JSON</span>
              <button
                className="copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(state.gameState, null, 2));
                  const btn = document.activeElement as HTMLButtonElement;
                  if (btn) {
                    const originalText = btn.innerText;
                    btn.innerText = '已复制！';
                    setTimeout(() => { btn.innerText = originalText; }, 2000);
                  }
                }}
              >
                复制 JSON
              </button>
            </div>
            <pre className="game-state-viewer">
              {JSON.stringify(state.gameState || {}, null, 2)}
            </pre>
          </div>
        </section>
      </div>
    );
  };

  const RoleDetailView = ({ roleId, perspective }: { roleId: string, perspective: any }) => {
    const gameConfig = roomState?.gameConfig || {};
    const gameWorkerUrl = gameConfig.gameWorkerUrl || '';
    const uiUrl = gameWorkerUrl ? `${gameWorkerUrl}/game-ui.html` : '';

    const handleAction = async (action: any) => {
      if (!selectedRoomId) return;
      try {
        await submitRoomAction(
          selectedRoomId,
          roleId,
          action.action_id || action.actionId,
          action.params
        );
        // Refresh perspective after action
        loadRolePerspective(roleId);
      } catch (err: any) {
        setError(err.message || '提交动作失败');
      }
    };

    const roleDisplayMapping = useMemo(() => {
      const mapping: Record<string, { name: string }> = {};
      const players = roomState?.players || {};
      const roleMap = roomState?.roleMapping || {};

      for (const [roleId, userId] of Object.entries(roleMap)) {
        const player = players[userId as string];
        if (player) {
          mapping[roleId] = { name: player.displayName || (userId as string) };
        }
      }
      return mapping;
    }, [roomState]);

    return (
      <div className="role-detail-view">
        <div className="room-detail-header">
          <div>
            <button className="back-button" onClick={() => setSelectedRoleId(null)}>
              ← 返回房间视图
            </button>
            <h2 style={{ marginTop: '0.5rem' }}>角色视角: {roleId}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="view-toggle">
              <button className={roleViewMode === 'visual' ? 'active' : ''} onClick={() => setRoleViewMode('visual')}>可视化</button>
              <button className={roleViewMode === 'raw' ? 'active' : ''} onClick={() => setRoleViewMode('raw')}>Raw JSON</button>
            </div>
            <button className="button" onClick={() => loadRolePerspective(roleId)} disabled={isRoleLoading}>
              {isRoleLoading ? '获取中...' : '刷新视角'}
            </button>
          </div>
        </div>

        {roleViewMode === 'visual' ? (
          <div className="game-ui-container-wrapper">
            <GameUIContainer
              gameId={gameConfig.gameId || 'unknown'}
              perspective={perspective}
              onAction={handleAction}
              isMyTurn={perspective?.your_role?.is_current || false}
              readonly={roomState?.phase !== 'playing'}
              metadata={{
                roomId: selectedRoomId || '',
                roleId: roleId,
                roleDisplayMapping,
              }}
              uiUrl={uiUrl}
            />
            <RoleStatusBar
              message={perspective?.message}
              identity={perspective?.your_role?.identity}
              error={error}
            />
          </div>
        ) : (
          <div className="game-state-container">
            <div className="game-state-header">
              <span className="game-state-header__title">Perspective Data</span>
              <button
                className="copy-button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(perspective, null, 2));
                }}
              >
                复制 JSON
              </button>
            </div>
            <pre className="game-state-viewer">
              {perspective ? JSON.stringify(perspective, null, 2) : '等待数据加载...'}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const handleLogout = () => {
    setAuthConfig(null);
    setConfigState(null);
  };

  const selectedInteraction = useMemo(() => {
    if (!selectedId) return null;
    return interactions.find((item) => item.interaction_id === selectedId) || null;
  }, [interactions, selectedId]);

  const loadInteractions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetchInteractions({
        status: statusFilter,
        playerType: playerTypeFilter,
        roomId: roomFilter || undefined,
        roleId: roleFilter || undefined,
        gameId: gameFilter || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
        order,
        limit: PAGE_SIZE,
      });

      setInteractions(response.data);
      setLastUpdated(new Date());

      if (response.data.length > 0) {
        if (!selectedId || !response.data.some((item) => item.interaction_id === selectedId)) {
          setSelectedId(response.data[0].interaction_id);
        }
      } else {
        setSelectedId(null);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, playerTypeFilter, roomFilter, roleFilter, gameFilter, startDateFilter, endDateFilter, order, selectedId]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  useEffect(() => {
    if (!autoRefresh || !roomFilter) {
      setStreamStatus('idle');
      return;
    }

    const eventSource = connectLogStream(
      {
        roomId: roomFilter,
        status: statusFilter,
        playerType: playerTypeFilter,
        roleId: roleFilter || undefined,
        gameId: gameFilter || undefined,
        startDate: startDateFilter || undefined,
        endDate: endDateFilter || undefined,
      },
      (nextLog) => {
        setStreamStatus('connected');
        setInteractions((prev) => {
          const idx = prev.findIndex((item) => item.interaction_id === nextLog.interaction_id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = nextLog;
            return copy;
          }
          const next = [nextLog, ...prev];
          if (order === 'asc') {
            next.sort((a, b) => (a.event_ts - b.event_ts) || a.interaction_id.localeCompare(b.interaction_id));
          } else {
            next.sort((a, b) => (b.event_ts - a.event_ts) || b.interaction_id.localeCompare(a.interaction_id));
          }
          return next.slice(0, PAGE_SIZE);
        });
        setLastUpdated(new Date());
      },
      () => setStreamStatus('disconnected')
    );

    return () => {
      eventSource.close();
      setStreamStatus('idle');
    };
  }, [
    autoRefresh,
    roomFilter,
    statusFilter,
    playerTypeFilter,
    roleFilter,
    gameFilter,
    startDateFilter,
    endDateFilter,
    order,
  ]);

  useEffect(() => {
    if (!selectedInteraction) {
      setTimelineState({ loading: false, error: null, data: null });
      return;
    }

    const controller = new AbortController();
    const groupId = selectedInteraction.interaction_group_id;

    setTimelineState({ loading: true, error: null, data: null });

    fetchInteractionGroup(groupId)
      .then((result) => {
        if (!controller.signal.aborted) {
          setTimelineState({ loading: false, error: null, data: result });
        }
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : '加载尝试记录失败';
        setTimelineState({ loading: false, error: message, data: null });
      });

    return () => controller.abort();
  }, [selectedInteraction]);

  const lastUpdatedText = useMemo(() => {
    if (!lastUpdated) return '—';
    return lastUpdated.toLocaleString('zh-CN', { hour12: false });
  }, [lastUpdated]);

  const loadRoomDetail = useCallback(async (roomId: string) => {
    if (!roomId) return;
    setIsRoomLoading(true);
    setSelectedRoomId(roomId);
    setSelectedRoleId(null); // Reset role view on room change
    localStorage.setItem('monitor_last_room_id', roomId);
    setError(null);
    try {
      const resp = await fetchRoomState(roomId);
      setRoomState(resp.data);
    } catch (err: any) {
      setError(err.message || '加载房间详情失败');
      setRoomState(null);
    } finally {
      setIsRoomLoading(false);
    }
  }, []);

  const loadRolePerspective = useCallback(async (roleId: string) => {
    if (!selectedRoomId || !roleId) return;
    setIsRoleLoading(true);
    setSelectedRoleId(roleId);
    setError(null);
    try {
      const resp = await fetchRoomPerspective(selectedRoomId, roleId);
      setRolePerspective(resp.data);
    } catch (err: any) {
      setError(err.message || '加载视角失败');
    } finally {
      setIsRoleLoading(false);
    }
  }, [selectedRoomId]);

  useEffect(() => {
    if (navMode === 'rooms' && selectedRoomId && !roomState && !isRoomLoading) {
      loadRoomDetail(selectedRoomId);
    }
  }, [navMode, selectedRoomId, roomState, isRoomLoading, loadRoomDetail]);

  if (!config) {
    return (
      <div className="auth-overlay">
        <form
          className="auth-form"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            const baseUrl = formData.get('baseUrl') as string;
            const backendUrl = formData.get('backendUrl') as string;
            const adminSecret = formData.get('adminSecret') as string;
            if (baseUrl && adminSecret) {
              const newConfig = { baseUrl, backendUrl: backendUrl || undefined, adminSecret };
              setAuthConfig(newConfig);
              setConfigState(newConfig);
            }
          }}
        >
          <h2>LLM Monitor</h2>
          <p>请输入 Nexus Engine 配置信息</p>
          <div className="auth-field">
            <label>Engine URL</label>
            <input
              name="baseUrl"
              type="url"
              placeholder="https://nexus-engine.xxx.workers.dev"
              required
              defaultValue={import.meta.env.VITE_MONITOR_API_BASE_URL || ''}
            />
          </div>
          <div className="auth-field">
            <label>Admin Secret</label>
            <input
              name="adminSecret"
              type="password"
              placeholder="输入 ADMIN_SECRET"
              required
            />
          </div>
          <div className="auth-field" style={{ marginTop: '1rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
            <label>Backend URL (选填, 用于后代存储管理)</label>
            <input
              name="backendUrl"
              type="url"
              placeholder="https://np-hono-backend.xxx.workers.dev"
              defaultValue={import.meta.env.VITE_BACKEND_API_BASE_URL || ''}
            />
          </div>
          <button type="submit" className="button">
            进入面板
          </button>
        </form>
      </div>
    );
  }

  if (navMode === 'menu') {
    return (
      <div className="monitor-app">
        <header className="toolbar">
          <div>
            <h1>监控面板</h1>
            <p className="toolbar__subtitle">
              管理与观察 Nexus Engine 运行状态 ({new URL(config.baseUrl).hostname})
            </p>
          </div>
          <button onClick={handleLogout} className="button logout-button">退出登录</button>
        </header>

        <main className="menu-view">
          <div className="menu-grid">
            <div className="menu-card" onClick={() => setNavMode('logs')}>
              <div className="icon">📜</div>
              <h2>交互日志监控</h2>
              <p>实时查看与追溯 LLM 玩家与人类玩家的交互记录，分析 Prompt 效果与错误原因。</p>
            </div>
            <div className="menu-card" onClick={() => setNavMode('rooms')}>
              <div className="icon">🏠</div>
              <h2>Engine 内存房间状态</h2>
              <p>罗列当前所有活跃的 Durable Object 房间实例，查看完整的内存状态与游戏进程。</p>
            </div>
            <div className="menu-card" onClick={() => setNavMode('backendrooms')}>
              <div className="icon">🗄️</div>
              <h2>Backend 数据库房间</h2>
              <p>查看并管理 Hono Backend (D1 Database) 记录的所有持久化房间数据，支持安全清理与强制销毁。</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (navMode === 'rooms') {
    return (
      <div className="monitor-app">
        <header className="toolbar">
          <div className="nav-header">
            <button className="back-button" onClick={() => { setNavMode('menu'); setRoomState(null); }}>
              ← 返回主菜单
            </button>
            <h1>房间状态管理</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button onClick={() => selectedRoomId && loadRoomDetail(selectedRoomId)} className="button" disabled={isRoomLoading || !selectedRoomId}>
              {isRoomLoading ? '刷新中...' : '手动刷新'}
            </button>
            <button onClick={handleLogout} className="button logout-button">退出登录</button>
          </div>
        </header>

        <div className="room-search-bar" style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="输入 Room ID 或 DurableObject ID..."
            value={roomSearchTerm}
            onChange={e => setRoomSearchTerm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadRoomDetail(roomSearchTerm)}
          />
          <button className="button" onClick={() => loadRoomDetail(roomSearchTerm)} disabled={!roomSearchTerm || isRoomLoading}>
            确认并查看详情
          </button>
        </div>

        {error && navMode === 'rooms' ? (
          <div className="error-banner" style={{ marginBottom: '1rem' }}>加载失败：{error}</div>
        ) : null}

        {selectedRoomId ? (
          selectedRoleId ? (
            <RoleDetailView roleId={selectedRoleId} perspective={rolePerspective} />
          ) : (
            <div className="room-detail-view">
              <div className="room-detail-header">
                <div>
                  <h2 style={{ marginTop: '0.5rem' }}>房间详情: {selectedRoomId}</h2>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className="view-toggle">
                    <button className={roomViewMode === 'visual' ? 'active' : ''} onClick={() => setRoomViewMode('visual')}>可视化</button>
                    <button className={roomViewMode === 'raw' ? 'active' : ''} onClick={() => setRoomViewMode('raw')}>Raw JSON</button>
                  </div>
                </div>
              </div>

              {roomState ? (
                roomViewMode === 'visual' ? (
                  <RoomDetailVisual state={roomState} />
                ) : (
                  <div className="game-state-container">
                    <div className="game-state-header">
                      <span className="game-state-header__title">Room State JSON</span>
                      <button
                        className="copy-button"
                        onClick={() => {
                          navigator.clipboard.writeText(JSON.stringify(roomState, null, 2));
                        }}
                      >
                        复制 JSON
                      </button>
                    </div>
                    <pre className="game-state-viewer">
                      {JSON.stringify(roomState, null, 2)}
                    </pre>
                  </div>
                )
              ) : (
                <div className="empty-state">
                  {isRoomLoading ? '正在加载房间完整状态...' : '未获取到房间内容'}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="empty-state" style={{ padding: '4rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <p>请输入 Room ID 以开启实时监控</p>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              系统将通过 RPC 调取该房间的实时 Persistent State 并在本地缓存 ID。
            </p>
          </div>
        )}
      </div>
    );
  }

  if (navMode === 'backendrooms') {
    return (
      <div className="monitor-app">
        <header className="toolbar">
          <div className="nav-header">
            <button className="back-button" onClick={() => { setNavMode('menu'); }}>
              ← 返回主菜单
            </button>
            <h1>Backend D1 数据库房间管理</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <span className="summary" style={{ marginRight: '1rem' }}>平台总房间数: {backendRoomsTotal}</span>
            <button onClick={loadBackendRooms} className="button" disabled={isBackendRoomsLoading}>
              {isBackendRoomsLoading ? '刷新中...' : '重载全量列表'}
            </button>
            <button onClick={handleLogout} className="button logout-button">退出登录</button>
          </div>
        </header>

        {backendRoomsError ? (
          <div className="error-banner" style={{ marginBottom: '1rem' }}>加载失败：{backendRoomsError}</div>
        ) : null}

        <main className="layout" style={{ display: 'block', padding: '1rem' }}>
          {backendRooms.length === 0 && !isBackendRoomsLoading ? (
            <div className="empty-state">尚未创建任何房间</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', background: '#1e293b', borderRadius: '0.5rem', overflow: 'hidden' }}>
                <thead style={{ background: '#0f172a' }}>
                  <tr>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Room ID</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Name</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Owner ID</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Game ID</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Status</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Public?</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>Created At</th>
                    <th style={{ padding: '1rem', borderBottom: '1px solid #334155' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {backendRooms.map(room => (
                    <tr key={room.room_id} style={{ borderBottom: '1px solid #334155' }}>
                      <td style={{ padding: '1rem', fontFamily: 'monospace', opacity: 0.8 }}>{room.room_id}</td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>{room.room_name}</td>
                      <td style={{ padding: '1rem', fontSize: '0.875rem' }}>{room.owner_uid}</td>
                      <td style={{ padding: '1rem' }}>{room.game_id || '-'}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`phase-badge phase--${room.room_status}`}>
                          {room.room_status}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>{room.is_public ? '是' : '否'}</td>
                      <td style={{ padding: '1rem', opacity: 0.6 }}>{new Date(room.created_at).toLocaleString('zh-CN')}</td>
                      <td style={{ padding: '1rem' }}>
                        <button
                          className="button"
                          style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', borderColor: '#ef4444' }}
                          onClick={() => handleDeleteBackendRoom(room.room_id)}
                        >
                          强制删除
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="monitor-app">
      <header className="toolbar">
        <div>
          <div className="nav-header">
            <button className="back-button" onClick={() => setNavMode('menu')}>
              ← 返回主菜单
            </button>
            <h1>交互日志</h1>
          </div>
          <p className="toolbar__subtitle">
            观察 Nexus Playground 中 LLM 与 Human 玩家动作日志 ({new URL(config.baseUrl).hostname})
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={handleLogout} className="button logout-button">
            退出登录
          </button>
          <div className="toolbar__filters">
            <div className="filter-row">
              <label>
                状态
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as '' | InteractionStatus)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                类型
                <select
                  value={playerTypeFilter}
                  onChange={(event) => setPlayerTypeFilter(event.target.value as '' | PlayerType)}
                >
                  {PLAYER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || 'all'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                房间 ID
                <input
                  type="text"
                  value={roomFilter}
                  onChange={(event) => setRoomFilter(event.target.value)}
                  placeholder="按房间过滤"
                />
              </label>

              <label>
                角色 ID
                <input
                  type="text"
                  value={roleFilter}
                  onChange={(event) => setRoleFilter(event.target.value)}
                  placeholder="按角色过滤"
                />
              </label>

              <label>
                游戏 ID
                <input
                  type="text"
                  value={gameFilter}
                  onChange={(event) => setGameFilter(event.target.value)}
                  placeholder="按游戏过滤"
                />
              </label>

              <label>
                开始时间
                <input
                  type="datetime-local"
                  value={startDateFilter}
                  onChange={(event) => setStartDateFilter(event.target.value)}
                />
              </label>

              <label>
                结束时间
                <input
                  type="datetime-local"
                  value={endDateFilter}
                  onChange={(event) => setEndDateFilter(event.target.value)}
                />
              </label>

              <label>
                排序
                <select value={order} onChange={(event) => setOrder(event.target.value as 'desc' | 'asc')}>
                  <option value="desc">最新优先</option>
                  <option value="asc">最早优先</option>
                </select>
              </label>
            </div>

            <div className="filter-row">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(event) => setAutoRefresh(event.target.checked)}
                />
                <span>实时流（SSE）</span>
              </label>
              <button type="button" className="button" onClick={loadInteractions} disabled={isLoading}>
                {isLoading ? '刷新中…' : '手动刷新'}
              </button>
              <span className="summary">当前显示 {interactions.length}/{PAGE_SIZE}</span>
            </div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="error-banner">加载列表失败：{error}</div>
      ) : null}

      <main className="layout">
        <aside className="interaction-list">
          {interactions.length === 0 && !isLoading ? (
            <div className="empty-state">暂无记录，等待新的 LLM 请求</div>
          ) : null}

          {interactions.map((interaction) => {
            const isActive = interaction.interaction_id === selectedId;
            return (
              <button
                key={interaction.interaction_id}
                type="button"
                className={`interaction-card${isActive ? ' interaction-card--active' : ''}`}
                onClick={() => setSelectedId(interaction.interaction_id)}
              >
                <div className="interaction-card__header">
                  <StatusBadge status={interaction.status} />
                  <AttemptChip
                    attempt={interaction.attempt}
                    outerAttempt={interaction.outer_attempt}
                  />
                </div>
                <div className="interaction-card__body">
                  <div className="interaction-card__title">
                    {interaction.game_name || interaction.game_id || '未设置游戏'}
                  </div>
                  <div className="interaction-card__meta">
                    <span>房间 {interaction.room_id}</span>
                    <span>角色 {interaction.role_id}</span>
                    <span>类型 {interaction.player_type}</span>
                  </div>
                  <div className="interaction-card__time">
                    {formatTimestamp(interaction.created_at)}
                  </div>
                </div>
                {interaction.error_message ? (
                  <div className="interaction-card__error" title={interaction.error_message}>
                    ⚠️ {interaction.error_message}
                  </div>
                ) : null}
              </button>
            );
          })}
        </aside>

        <section className="details">
          {!selectedInteraction ? (
            <div className="empty-detail">请选择左侧的交互记录查看详情</div>
          ) : (
            <div className="detail-panel">
              <header className="detail-panel__header">
                <div>
                  <h2>{selectedInteraction.game_name || selectedInteraction.game_id || '未知游戏'}</h2>
                  <p>
                    房间 {selectedInteraction.room_id} · 角色 {selectedInteraction.role_id} · 类型 {selectedInteraction.player_type} · 模型 {selectedInteraction.model_name || '—'}
                  </p>
                </div>
                <div className="detail-panel__status">
                  <StatusBadge status={selectedInteraction.status} />
                  <AttemptChip
                    attempt={selectedInteraction.attempt}
                    outerAttempt={selectedInteraction.outer_attempt}
                  />
                </div>
              </header>

              <div className="detail-panel__grid">
                <div>
                  <h3>提示信息</h3>
                  <div className="detail-block">
                    <h4>System Prompt</h4>
                    <pre>{selectedInteraction.system_prompt || '（仅 LLM 类型可用）'}</pre>
                  </div>
                  <div className="detail-block">
                    <h4>应用 Prompt</h4>
                    <pre>{selectedInteraction.user_prompt || '（仅 LLM 类型可用）'}</pre>
                  </div>
                </div>

                <div>
                  <h3>回应与反馈</h3>
                  <div className="detail-block">
                    <h4>LLM 回复</h4>
                    <pre>{selectedInteraction.response || '（暂无回应）'}</pre>
                  </div>
                  <div className="detail-block detail-block--meta">
                    <p>
                      创建时间：{formatTimestamp(selectedInteraction.created_at)}
                    </p>
                    <p>
                      更新时间：{formatTimestamp(selectedInteraction.updated_at)}
                    </p>
                    <p>响应耗时：{formatResponseTime(selectedInteraction.response_time_ms)}</p>
                    {selectedInteraction.previous_error ? (
                      <p>上一轮错误：{selectedInteraction.previous_error}</p>
                    ) : null}
                    {selectedInteraction.error_message ? (
                      <p className="detail-error">最终错误：{selectedInteraction.error_message}</p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="detail-panel__timeline">
                <h3>重试详情</h3>
                {timelineState.loading ? (
                  <div className="timeline timeline--loading">加载尝试记录中…</div>
                ) : timelineState.error ? (
                  <div className="timeline timeline--error">{timelineState.error}</div>
                ) : timelineState.data && timelineState.data.data.length > 0 ? (
                  <ul className="timeline">
                    {timelineState.data.data.map((item) => (
                      <li key={item.interaction_id} className="timeline__item">
                        <div className="timeline__header">
                          <StatusBadge status={item.status} />
                          <AttemptChip
                            attempt={item.attempt}
                            outerAttempt={item.outer_attempt}
                          />
                          <span className="timeline__time">
                            {formatTimestamp(item.created_at)}
                          </span>
                        </div>
                        <div className="timeline__content">
                          <p>
                            模型：{item.model_name} · 房间 {item.room_id} · 角色 {item.role_id}
                          </p>
                          <p>响应耗时：{formatResponseTime(item.response_time_ms)}</p>
                          {item.error_message ? (
                            <p className="timeline__error">错误：{item.error_message}</p>
                          ) : null}
                          {item.response ? (
                            <details>
                              <summary>展开查看回复内容</summary>
                              <pre>{item.response}</pre>
                            </details>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="timeline timeline--empty">仅有单次尝试</div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

