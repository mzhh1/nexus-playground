import React, { useMemo, useState } from 'react';
import type { GameUIProps, Action } from '@nexus/game-sdk';
import styles from './ui.module.css';

type GenericRecord = Record<string, any>;

const WerewolfUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly }) => {
  const { current_state, your_role, action_space_definition } = perspective;
  const state = current_state as GenericRecord;
  const roleId: string | null = state.my_role_id ?? null;
  const isSpectator = your_role.identity.toLowerCase().includes('spectator');
  const [formValues, setFormValues] = useState<Record<string, Record<string, any>>>({});

  const disabledBase = readonly || !isMyTurn || !roleId;
  const alivePlayers: string[] = state.alive_players ?? [];
  const deadPlayers: Record<string, string> = state.dead_players ?? {};
  const identityMap: Record<string, string> = state.all_identities ?? {};
  const pendingRoles: string[] = state.pending_roles ?? [];

  const players = useMemo(() => {
    const allPlayerIds = new Set([...alivePlayers, ...Object.keys(deadPlayers)]);
    return Array.from(allPlayerIds).sort().map((id) => ({
      id,
      alive: !deadPlayers[id],
      identity: identityMap[id],
      isCurrent: pendingRoles.length > 0 && pendingRoles[0] === id,
    }));
  }, [alivePlayers, deadPlayers, identityMap, pendingRoles]);

  const handleSubmit = (actionId: string, params?: Record<string, any>) => {
    if (disabledBase) return;
    const action: Action = {
      action_id: actionId,
      role_id: roleId!,
      params,
    };
    onAction(action);
  };

  const updateFormValue = (actionId: string, field: string, value: any) => {
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
          className={styles.actionButton}
          disabled={disabledBase}
          onClick={() => handleSubmit(actionDef.action_id)}
        >
          {actionDef.description}
        </button>
      );
    }

    const values = formValues[actionDef.action_id] ?? {};
    const handleActionEnter = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSubmit(actionDef.action_id, values);
      }
    };
    return (
      <div
        key={actionDef.action_id}
        className={styles.actionForm}
      >
        <div className={styles.formTitle}>{actionDef.description}</div>
        {Object.entries(schema).map(([field, definition]) => {
          const fieldValue = values[field] ?? '';
          const label = definition.description ?? field;
          const enums = Array.isArray(definition.enum) ? definition.enum : null;
          if (enums) {
            return (
              <label key={field} className={styles.field}>
                <span>{label}</span>
                <select
                  className={styles.input}
                  value={fieldValue}
                  disabled={disabledBase}
                  onChange={(event) => updateFormValue(actionDef.action_id, field, event.target.value)}
                  onKeyDown={handleActionEnter}
                >
                  <option value="">请选择</option>
                  {enums.map((v: string) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label key={field} className={styles.field}>
              <span>{label}</span>
              <input
                className={styles.input}
                value={fieldValue}
                disabled={disabledBase}
                onChange={(event) => updateFormValue(actionDef.action_id, field, event.target.value)}
                onKeyDown={handleActionEnter}
              />
            </label>
          );
        })}
        <button
          type="button"
          className={styles.actionButton}
          disabled={disabledBase}
          onClick={() => handleSubmit(actionDef.action_id, values)}
        >
          提交
        </button>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>狼人杀</div>
          <div className={styles.subtitle}>第 {state.day ?? 1} 天 · {formatPhase(state.phase)} {state.night_sub_phase ? `(${formatNightLabel(state.night_sub_phase)})` : ''}</div>
        </div>
        <div className={styles.role}>
          {isSpectator ? '👀 观战者（上帝视角）' : `你的身份：${your_role.identity}`}
        </div>
      </div>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h3>玩家状态</h3>
          <div className={styles.playerList}>
            {players.map((player) => (
              <div key={player.id} className={`${styles.player} ${player.alive ? styles.alive : styles.dead}`}>
                <span>{player.id}</span>
                <span>{player.alive ? '存活' : `出局(${formatIdentityLabel(player.identity || deadPlayers[player.id])})`}</span>
                {player.isCurrent && <span className={styles.current}>当前行动</span>}
              </div>
            ))}
          </div>
        </section>

        <section className={styles.panel}>
          <h3>局势信息</h3>
          <div className={styles.kv}>存活人数：{alivePlayers.length}</div>
          {state.current_speaker && <div className={styles.kv}>当前发言：{state.current_speaker}</div>}
          {state.hunter_pending && <div className={styles.kv}>猎人行动：{state.hunter_pending}</div>}
          {state.last_day_exile && <div className={styles.kv}>昨日放逐：{state.last_day_exile}</div>}
          {Array.isArray(state.last_night_deaths) && state.last_night_deaths.length > 0 && (
            <div className={styles.kv}>昨夜死亡：{state.last_night_deaths.map((d: any) => d.victim).join('、')}</div>
          )}
          {isSpectator && state.all_identities && (
            <div className={styles.identityMap}>
              {Object.entries(state.all_identities).map(([pid, identity]) => (
                <div key={pid}>{pid}: {formatIdentityLabel(identity as string)}</div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className={styles.panel}>
        <h3>历史</h3>
        {Array.isArray(state.speech_history) && state.speech_history.length > 0 ? (
          <ul className={styles.history}>
            {state.speech_history.map((speech: any, idx: number) => (
              <li key={`${speech.speaker}-${idx}`}><b>{speech.speaker}</b>: {speech.content}</li>
            ))}
          </ul>
        ) : (
          <div className={styles.empty}>暂无发言记录</div>
        )}
      </section>

      <section className={styles.panel}>
        <h3>可用行动</h3>
        {action_space_definition.actions.length === 0 || !roleId ? (
          <div className={styles.empty}>当前无可执行行动</div>
        ) : (
          <div className={styles.actions}>
            {action_space_definition.actions.map(renderActionControl)}
          </div>
        )}
      </section>
    </div>
  );
};

function formatPhase(phase: string): string {
  switch (phase) {
    case 'night': return '夜晚阶段';
    case 'day_discussion': return '白天讨论';
    case 'day_voting': return '白天投票';
    case 'last_words': return '遗言阶段';
    case 'hunter_shoot': return '猎人行动';
    case 'game_over': return '游戏结束';
    default: return phase;
  }
}

function formatNightLabel(subPhase: string | null): string {
  if (!subPhase) return '夜晚';
  switch (subPhase) {
    case 'guard': return '守卫行动';
    case 'werewolf': return '狼人行动';
    case 'seer': return '预言家查验';
    case 'witch': return '女巫用药';
    default: return subPhase;
  }
}

function formatIdentityLabel(identity: string | undefined): string {
  const mapping: Record<string, string> = {
    werewolf: '狼人',
    seer: '预言家',
    witch: '女巫',
    hunter: '猎人',
    guard: '守卫',
    villager: '平民',
  };
  return identity ? (mapping[identity] ?? identity) : '未知';
}

export default WerewolfUI;
