import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PAGE_SIZE,
  DEFAULT_REFRESH_INTERVAL,
  fetchInteractionGroup,
  fetchInteractions,
} from './api';
import {
  InteractionStatus,
  LLMInteraction,
  InteractionGroupResponse,
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
const REFRESH_INTERVAL = DEFAULT_REFRESH_INTERVAL;

function App() {
  const [statusFilter, setStatusFilter] = useState<'' | InteractionStatus>('');
  const [roomFilter, setRoomFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
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
        roomId: roomFilter || undefined,
        roleId: roleFilter || undefined,
        gameId: gameFilter || undefined,
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
  }, [statusFilter, roomFilter, roleFilter, gameFilter, order, selectedId]);

  useEffect(() => {
    loadInteractions();
  }, [loadInteractions]);

  useEffect(() => {
    if (!autoRefresh) return;

    const timer = setInterval(() => {
      loadInteractions();
    }, REFRESH_INTERVAL);

    return () => clearInterval(timer);
  }, [autoRefresh, loadInteractions]);

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

  return (
    <div className="monitor-app">
      <header className="toolbar">
        <div>
          <h1>LLM 监控面板</h1>
          <p className="toolbar__subtitle">
            观察 Nexus Playground 中 LLM 玩家产生的系统提示、应用提示与回应
          </p>
        </div>

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
              <span>自动刷新（{Math.round(REFRESH_INTERVAL / 1000)}s）</span>
            </label>
            <button type="button" className="button" onClick={loadInteractions} disabled={isLoading}>
              {isLoading ? '刷新中…' : '手动刷新'}
            </button>
            <span className="last-updated">最近刷新：{lastUpdatedText}</span>
            <span className="summary">当前显示 {interactions.length}/{PAGE_SIZE}</span>
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
                    房间 {selectedInteraction.room_id} · 角色 {selectedInteraction.role_id} · 模型 {selectedInteraction.model_name}
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
                    <pre>{selectedInteraction.system_prompt}</pre>
                  </div>
                  <div className="detail-block">
                    <h4>应用 Prompt</h4>
                    <pre>{selectedInteraction.user_prompt}</pre>
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

