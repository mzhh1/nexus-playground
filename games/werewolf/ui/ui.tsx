import React, { useMemo, useState } from 'react';
import type { GameUIProps } from '../../../frontend/src/lib/game-ui-types';
import type { Action } from '../../../frontend/src/lib/types';
import styles from './ui.module.css';
import actionPrompts from '../logic/action-prompts.json' with { type: 'json' };

type GenericRecord = Record<string, any>;

const WerewolfUI: React.FC<GameUIProps> = ({
  perspective,
  onAction,
  isMyTurn,
  readonly,
}) => {
  const { current_state, your_role, action_space_definition } = perspective;
  const state = current_state as GenericRecord;
  const roleId: string | null = state.my_role_id ?? null;
  const isSpectator = your_role.identity.toLowerCase().includes('spectator');

  const alivePlayers: string[] = state.alive_players ?? [];
  const deadPlayers: Record<string, string> = state.dead_players ?? {};
  const identityMap: Record<string, string> = state.all_identities ?? {};
  const pendingRoles: string[] = state.pending_roles ?? [];

  const players = useMemo(() => {
    // 创建所有玩家列表（存活的 + 死亡的）
    const allPlayerIds = new Set([...alivePlayers, ...Object.keys(deadPlayers)]);
    const order = Array.from(allPlayerIds).sort();
    return order.map((id) => ({
      id,
      alive: !deadPlayers[id],
      identity: identityMap[id],
      isCurrent: pendingRoles.length > 0 && pendingRoles[0] === id,
    }));
  }, [alivePlayers, deadPlayers, identityMap, pendingRoles]);

  const [formValues, setFormValues] = useState<Record<string, Record<string, any>>>({});

  const disabledBase = readonly || !isMyTurn || !roleId;

  const handleSimpleAction = (actionId: string) => {
    if (disabledBase) return;
    const action: Action = {
      action_id: actionId,
      role_id: roleId!,
    };
    onAction(action);
  };

  const handleFormSubmit = (actionId: string, params: Record<string, any>) => {
    if (disabledBase) return;
    const action: Action = {
      action_id: actionId,
      role_id: roleId!,
      params,
    };
    onAction(action);
  };

  const updateFormValue = (
    actionId: string,
    field: string,
    value: any,
  ) => {
    setFormValues((prev) => ({
      ...prev,
      [actionId]: {
        ...(prev[actionId] ?? {}),
        [field]: value,
      },
    }));
  };

  const renderActionControl = (actionDef: GenericRecord) => {
    const schema = actionDef.params_schema as Record<string, GenericRecord> | null | undefined;

    if (!schema || Object.keys(schema).length === 0) {
      return (
        <button
          key={actionDef.action_id}
          className={styles['action-button']}
          disabled={disabledBase}
          onClick={() => handleSimpleAction(actionDef.action_id)}
        >
          {actionDef.description}
        </button>
      );
    }

    const values = formValues[actionDef.action_id] ?? {};

    return (
      <form
        key={actionDef.action_id}
        className={styles['action-form']}
        onSubmit={(event) => {
          event.preventDefault();
          handleFormSubmit(actionDef.action_id, values);
        }}
      >
        <div className={styles['label']}>{actionDef.description}</div>
        {Object.entries(schema).map(([field, definition]) => {
          const fieldValue = values[field] ?? '';
          const fieldType = definition.type ?? 'string';
          const label = definition.description ?? field;

          if (fieldType === 'string') {
            const isLong = field.toLowerCase().includes('content') || fieldValue.length > 40;
            return isLong ? (
              <div key={field}>
                <label className={styles['label']} htmlFor={`${actionDef.action_id}-${field}`}>
                  {label}
                </label>
                <textarea
                  id={`${actionDef.action_id}-${field}`}
                  className={styles['textarea']}
                  value={fieldValue}
                  disabled={disabledBase}
                  onChange={(event) => updateFormValue(actionDef.action_id, field, event.target.value)}
                />
              </div>
            ) : (
              <div key={field}>
                <label className={styles['label']} htmlFor={`${actionDef.action_id}-${field}`}>
                  {label}
                </label>
                <input
                  id={`${actionDef.action_id}-${field}`}
                  className={styles['input']}
                  type="text"
                  value={fieldValue}
                  disabled={disabledBase}
                  onChange={(event) => updateFormValue(actionDef.action_id, field, event.target.value)}
                />
              </div>
            );
          }

          if (fieldType === 'integer' || fieldType === 'number') {
            return (
              <div key={field}>
                <label className={styles['label']} htmlFor={`${actionDef.action_id}-${field}`}>
                  {label}
                </label>
                <input
                  id={`${actionDef.action_id}-${field}`}
                  className={styles['input']}
                  type="number"
                  value={fieldValue}
                  disabled={disabledBase}
                  onChange={(event) => updateFormValue(actionDef.action_id, field, event.target.value)}
                />
              </div>
            );
          }

          return null;
        })}

        <button
          type="submit"
          className={styles['action-button']}
          disabled={disabledBase}
        >
          提交行动
        </button>
      </form>
    );
  };

  const renderIdentityInsights = () => {
    const chips: Array<React.ReactNode> = [];

    if (Array.isArray(state.teammates) && state.teammates.length > 0) {
      chips.push(
        <div key="teammates" className={styles['pill-list']}>
          <span className={styles['badge']}>狼人队友</span>
          {state.teammates.map((mate: string) => (
            <span key={mate} className={styles['pill']}>
              {mate}
            </span>
          ))}
        </div>
      );
    }

    if (Array.isArray(state.seer_checks) && state.seer_checks.length > 0) {
      chips.push(
        <div key="seer-checks">
          <div className={styles['badge']}>查验记录</div>
          <ul className={styles['history-list']}>
            {state.seer_checks.map((check: any, index: number) => (
              <li key={`${check.target}-${index}`}>
                第{check.night}夜查验 <span className={styles['highlight']}>{check.target}</span> → {check.result === 'werewolf' ? '狼人' : '好人'}
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (typeof state.antidote_available === 'boolean' || typeof state.poison_available === 'boolean') {
      chips.push(
        <div key="witch-info" className={styles['pill-list']}>
          <span className={styles['badge']}>女巫药剂</span>
          <span className={styles['pill']}>
            解药：{state.antidote_available ? '可用' : '已用'}
          </span>
          <span className={styles['pill']}>
            毒药：{state.poison_available ? '可用' : '已用'}
          </span>
        </div>
      );

      if (state.tonight_werewolf_target) {
        chips.push(
          <div key="witch-target" className={styles['pill']}>
            狼人目标：{state.tonight_werewolf_target}
          </div>
        );
      }

      if (state.tonight_poison_target) {
        chips.push(
          <div key="witch-poison" className={styles['pill']}>
            毒药目标：{state.tonight_poison_target}
          </div>
        );
      }
    }

    if (state.last_guard_target) {
      chips.push(
        <div key="guard-info" className={styles['pill']}>
          上次守护：{state.last_guard_target}
        </div>
      );
    }

    if (typeof state.can_shoot === 'boolean') {
      chips.push(
        <div key="hunter-info" className={styles['pill']}>
          猎人技能：{state.can_shoot ? '可发动' : '不可发动'}
        </div>
      );
    }

    if (chips.length === 0) {
      return (
        <div className={styles['section']}>
          <div className={styles['empty-state']}>暂无额外身份信息。</div>
        </div>
      );
    }

    return <div className={styles['section']}>{chips}</div>;
  };

  const renderHistorySection = () => {
    const historyBlocks: Array<React.ReactNode> = [];

    if (Array.isArray(state.speech_history) && state.speech_history.length > 0) {
      historyBlocks.push(
        <div key="speech-history" className={`${styles['section']} ${styles['speech-history-wide']}`}>
          <h3>发言记录（第{state.day}天）</h3>
          <ul className={styles['history-list']}>
            {state.speech_history.map((speech: any, index: number) => (
              <li key={`${speech.speaker}-${index}`}>
                <strong>{speech.speaker}：</strong>
                <span>{speech.content}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (Array.isArray(state.last_words_history) && state.last_words_history.length > 0) {
      // 按天数和时间排序所有遗言
      const sortedLastWords = [...state.last_words_history].sort((a: any, b: any) => {
        const dayA = a.day || 0;
        const dayB = b.day || 0;
        if (dayA !== dayB) {
          return dayA - dayB;
        }
        // 同一天内按时间戳排序
        const timeA = a.timestamp || '';
        const timeB = b.timestamp || '';
        return timeA.localeCompare(timeB);
      });

      historyBlocks.push(
        <div key="last-words-history" className={styles['section']}>
          <h3>💬 遗言记录</h3>
          <ul className={styles['history-list']}>
            {sortedLastWords.map((lastWords: any, index: number) => (
              <li key={`${lastWords.speaker}-${lastWords.day}-${index}`}>
                <strong className={styles['highlight']}>{lastWords.speaker}（第{lastWords.day || '?'}天）：</strong>
                <span className={styles['last-words-content']}>{lastWords.content}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (Array.isArray(state.last_night_deaths) && state.last_night_deaths.length > 0) {
      historyBlocks.push(
        <div key="night-deaths" className={styles['section']}>
          <h3>昨夜事件</h3>
          <ul className={styles['history-list']}>
            {state.last_night_deaths.map((record: any, index: number) => (
              <li key={`${record.victim}-${index}`}>
                {record.victim} 因 {formatCause(record.cause)} 身亡
              </li>
            ))}
          </ul>
        </div>
      );
    }

    if (state.last_day_exile) {
      historyBlocks.push(
        <div key="day-exile" className={styles['section']}>
          <h3>昨日公投</h3>
          <div>被放逐者：<span className={styles['highlight']}>{state.last_day_exile}</span></div>
        </div>
      );
    }

    if (isSpectator) {
      if (Array.isArray(state.vote_history) && state.vote_history.length > 0) {
        historyBlocks.push(
          <div key="vote-history" className={styles['section']}>
            <h3>投票历史</h3>
            <ul className={styles['history-list']}>
              {state.vote_history.map((record: any, index: number) => (
                <li key={`vote-${index}`}>
                  第{record.day}天：放逐 {record.exiled ?? '无人'}
                </li>
              ))}
            </ul>
          </div>
        );
      }

      if (Array.isArray(state.death_history) && state.death_history.length > 0) {
        historyBlocks.push(
          <div key="death-history" className={styles['section']}>
            <h3>死亡记录</h3>
            <ul className={styles['history-list']}>
              {state.death_history.map((record: any, index: number) => (
                <li key={`death-${index}`}>
                  第{record.day}天（{formatPhase(record.phase)}）：{record.victim} → {formatCause(record.cause)}
                </li>
              ))}
            </ul>
          </div>
        );
      }
    }

    if (historyBlocks.length === 0) {
      return null;
    }

    return <div className={styles['content-grid']}>{historyBlocks}</div>;
  };

  // 计算剩余身份人数显示
  const renderIdentityCount = () => {
    const identityLabels: Record<string, string> = {
      werewolf: '狼人',
      seer: '预言家',
      witch: '女巫',
      hunter: '猎人',
      guard: '守卫',
      villager: '平民',
    };

    const counts: Array<{ label: string; count: number }> = [];
    Object.entries(state.alive_identity ?? {}).forEach(([identity, count]) => {
      const numCount = typeof count === 'number' ? count : 0;
      if (numCount > 0) {
        counts.push({
          label: identityLabels[identity] || identity,
          count: numCount,
        });
      }
    });

    return (
      <div className={styles['identity-counts']}>
        {counts.map((item) => (
          <span key={item.label} className={styles['identity-count-item']}>
            {item.label}: {item.count}
          </span>
        ))}
      </div>
    );
  };

  // 获取自己的身份显示
  const myIdentity = roleId && identityMap[roleId] ? formatIdentityLabel(identityMap[roleId]) : your_role.identity;
  const myAlive = roleId ? !deadPlayers[roleId] : true;

  // 获取其他玩家的身份显示（考虑狼人队友和预言家查验）
  const getOtherPlayerIdentity = (player: any): string => {
    // 游戏结束时，显示所有玩家的真实身份
    if (state.phase === 'game_over') {
      if (player.identity) {
        return formatIdentityLabel(player.identity);
      }
      // 如果player.identity不存在，尝试从identityMap获取
      if (identityMap[player.id]) {
        return formatIdentityLabel(identityMap[player.id]);
      }
      return '？';
    }

    // 如果玩家已死亡，显示真实身份
    if (!player.alive) {
      if (isSpectator && player.identity) {
        return formatIdentityLabel(player.identity);
      }
      if (deadPlayers[player.id]) {
        return formatIdentityLabel(deadPlayers[player.id]);
      }
      return '？';
    }

    // 存活玩家 - 检查是否是狼人队友
    const teammates: string[] = state.teammates ?? [];
    if (teammates.includes(player.id)) {
      return '狼人';
    }

    // 检查是否被预言家查验过
    const seerChecks: Array<{ target: string; result: string; night: number }> = state.seer_checks ?? [];
    const checkResult = seerChecks.find((check) => check.target === player.id);
    if (checkResult) {
      // 预言家查验结果：狼人或好人
      return checkResult.result === 'werewolf' ? '狼人' : '好人';
    }

    // 观战者可以看到所有身份
    if (isSpectator && player.identity) {
      return formatIdentityLabel(player.identity);
    }

    // 默认显示 ？
    return '？';
  };

  // 获取当前阶段的行动提示
  const actionPrompt = useMemo(() => {
    const phase = state.phase as string;
    const nightSubPhase = state.night_sub_phase as string | null;

    if (phase === 'night' && nightSubPhase) {
      const nightPrompts = (actionPrompts as any).night;
      return nightPrompts?.[nightSubPhase]?.prompt || null;
    }

    const phasePrompts = (actionPrompts as any)[phase];
    return phasePrompts?.default?.prompt || null;
  }, [state.phase, state.night_sub_phase]);

  return (
    <div className={styles['container']}>
      {/* 状态栏 */}
      <div className={styles['status-bar']}>
        <div className={styles['status-bar-left']}>
          <span className={styles['day-info']}>第 {state.day} 天</span>
          <span className={styles['phase-info']}>{formatPhase(state.phase)}</span>
          {state.night_sub_phase && (
            <span className={styles['sub-phase-info']}>({formatNightLabel(state.night_sub_phase)})</span>
          )}
        </div>
        <div className={styles['status-bar-right']}>
          {renderIdentityCount()}
        </div>
      </div>

      {/* 角色区 */}
      <div className={styles['roles-section']}>
        {/* 我的身份区域 */}
        <div className={styles['my-role-area']}>
          <div className={styles['area-label']}>我的身份</div>
          {roleId && (
            <div className={`${styles['role-card']} ${myAlive ? styles['role-card-alive'] : styles['role-card-dead']}`}>
              <div className={styles['role-id']}>{roleId}</div>
              <div className={styles['role-identity']}>{myIdentity}</div>
            </div>
          )}
        </div>

        {/* 竖线分割 */}
        <div className={styles['vertical-divider']}></div>

        {/* 其他角色区域 */}
        <div className={styles['others-role-area']}>
          <div className={styles['area-label']}>其他角色</div>
          <div className={styles['roles-grid']}>
            {players
              .filter((p) => p.id !== roleId)
              .map((player) => {
                const displayIdentity = getOtherPlayerIdentity(player);
                
                return (
                  <div
                    key={player.id}
                    className={`${styles['role-card']} ${player.alive ? styles['role-card-alive'] : styles['role-card-dead']} ${player.isCurrent ? styles['role-card-current'] : ''}`}
                  >
                    <div className={styles['role-id']}>{player.id}</div>
                    <div className={styles['role-identity']}>{displayIdentity}</div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* 阶段对应区域 */}
      <div className={styles['phase-area']}>
        {/* 额外身份信息（女巫药剂、守卫上次守护等） */}
        {!isSpectator && (
          <>
            {typeof state.antidote_available === 'boolean' || typeof state.poison_available === 'boolean' ? (
              <div className={styles['section']}>
                <h3>女巫药剂</h3>
                <div className={styles['pill-list']}>
                  <span className={styles['pill']}>
                    解药：{state.antidote_available ? '可用' : '已用'}
                  </span>
                  <span className={styles['pill']}>
                    毒药：{state.poison_available ? '可用' : '已用'}
                  </span>
                </div>
                {state.tonight_werewolf_target && (
                  <div className={styles['pill']}>
                    狼人目标：{state.tonight_werewolf_target}
                  </div>
                )}
                {state.tonight_poison_target && (
                  <div className={styles['pill']}>
                    毒药目标：{state.tonight_poison_target}
                  </div>
                )}
              </div>
            ) : null}
            
            {state.last_guard_target && (
              <div className={styles['section']}>
                <h3>守卫信息</h3>
                <div className={styles['pill']}>
                  上次守护：{state.last_guard_target}
                </div>
              </div>
            )}
            
            {typeof state.can_shoot === 'boolean' && (
              <div className={styles['section']}>
                <h3>猎人信息</h3>
                <div className={styles['pill']}>
                  技能：{state.can_shoot ? '可发动' : '不可发动'}
                </div>
              </div>
            )}
          </>
        )}

        {/* 投票情况 */}
        {state.current_votes && Object.keys(state.current_votes).length > 0 && (
          <div className={styles['section']}>
            <h3>已投票情况</h3>
            <ul className={styles['history-list']}>
              {Object.entries(state.current_votes).map(([voter, target]) => {
                const targetStr = String(target);
                return (
                  <li key={`vote-${voter}`}>
                    {voter} → {targetStr === 'skip' ? '弃票' : targetStr}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* 遗言待发表玩家 */}
        {Array.isArray(state.last_words_pending) && state.last_words_pending.length > 0 && (
          <div className={styles['section']}>
            <h3>💬 待发表遗言</h3>
            <div className={styles['pill-list']}>
              {state.last_words_pending.map((playerId: string) => (
                <span 
                  key={playerId} 
                  className={`${styles['pill']} ${styles['last-words-pending']}`}
                >
                  {playerId}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 历史记录 */}
        {renderHistorySection()}

        {/* 可用行动 */}
        <div className={styles['section']}>
          <h3>可用行动</h3>
          {actionPrompt && action_space_definition.actions.length > 0 && roleId && (
            <div className={styles['action-prompt']}>
              {actionPrompt}
            </div>
          )}
          {action_space_definition.actions.length === 0 || !roleId ? (
            <div className={styles['empty-state']}>
              当前无可执行的行动。
            </div>
          ) : (
            <div className={styles['actions']}>
              {action_space_definition.actions.map(renderActionControl)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function formatCause(cause: string): string {
  switch (cause) {
    case 'werewolf':
      return '狼人袭击';
    case 'poison':
      return '女巫毒药';
    case 'vote':
      return '白天公投';
    case 'hunter':
      return '猎人带走';
    default:
      return cause;
  }
}

function formatPhase(phase: string): string {
  switch (phase) {
    case 'night':
      return '夜晚阶段';
    case 'day_discussion':
      return '白天讨论';
    case 'day_voting':
      return '白天投票';
    case 'last_words':
      return '💬 遗言阶段';
    case 'hunter_shoot':
      return '猎人发动';
    case 'game_over':
      return '游戏结束';
    default:
      return phase;
  }
}

function formatNightLabel(subPhase: string | null): string {
  if (!subPhase) return '夜晚阶段';
  switch (subPhase) {
    case 'guard':
      return '守卫行动';
    case 'werewolf':
      return '狼人行动';
    case 'seer':
      return '预言家查验';
    case 'witch':
      return '女巫用药';
    default:
      return subPhase;
  }
}

function formatIdentityLabel(identity: string): string {
  const mapping: Record<string, string> = {
    werewolf: '狼人',
    seer: '预言家',
    witch: '女巫',
    hunter: '猎人',
    guard: '守卫',
    villager: '平民',
  };
  return mapping[identity] ?? identity;
}

export default WerewolfUI;

