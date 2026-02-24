import React, { useMemo, useState, useEffect, useRef } from 'react';
import styles from './ui.module.css';

type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
type UnoCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild_draw4';

interface UnoCard {
  id: string;
  type: UnoCardType;
  color: UnoColor | null;
  value?: number;
}

interface Action {
  action_id: string;
  role_id: string;
  params?: any;
}

interface GameUIProps {
  perspective: {
    current_state: {
      players: string[];
      currentRole: string;
      direction: 1 | -1;
      turn: number;
      winner: string | null;
      currentColor: UnoColor;
      topCard?: UnoCard;
      drawPileCount: number;
      discardPileCount: number;
      handCounts: Record<string, number>;
      yourHand: UnoCard[];
      turnStage: 'play_or_draw' | 'must_resolve_drawn';
      drawnCardId: string | null;
    };
    your_role: {
      identity: string;
      is_current: boolean;
    };
    action_space_definition: {
      actions: { action_id: string }[];
    };
    message?: string;
  };
  onAction: (action: Action) => void;
  isMyTurn: boolean;
  readonly: boolean;
  metadata?: {
    roleId?: string;
  };
}

const COLOR_MAP: Record<UnoColor, string> = {
  red: '#ef4444',
  yellow: '#facc15',
  green: '#22c55e',
  blue: '#3b82f6',
};

const UnoUI: React.FC<GameUIProps> = ({ perspective, onAction, isMyTurn, readonly, metadata }) => {
  const { current_state, action_space_definition } = perspective;
  const {
    players,
    currentRole,
    direction,
    turn,
    winner,
    currentColor,
    topCard,
    drawPileCount,
    handCounts,
    yourHand,
    turnStage,
    drawnCardId,
  } = current_state;

  const [colorModal, setColorModal] = useState<{
    actionId: 'play_card' | 'play_drawn';
    cardIndex?: number;
  } | null>(null);

  const roleId = metadata?.roleId ?? perspective.your_role.identity;
  const actionIds = useMemo(
    () => new Set((action_space_definition.actions ?? []).map((a) => a.action_id)),
    [action_space_definition.actions]
  );

  const canPlayCard = actionIds.has('play_card');
  const canDrawFromSpec = actionIds.has('draw_card');
  const canPassFromSpec = actionIds.has('pass_turn');
  const canPlayDrawnFromSpec = actionIds.has('play_drawn');

  const canDrawFallback = turnStage === 'play_or_draw' && !canPlayCard;
  const canPassFallback = turnStage === 'must_resolve_drawn';

  const canDraw = isMyTurn && !readonly && (canDrawFromSpec || canDrawFallback);
  const canPass = isMyTurn && !readonly && (canPassFromSpec || canPassFallback);
  const canPlayDrawn = isMyTurn && !readonly && canPlayDrawnFromSpec;

  const isPlayableCard = (card: UnoCard): boolean => {
    if (!isMyTurn || readonly) return false;

    if (turnStage === 'must_resolve_drawn') {
      return canPlayDrawn && card.id === drawnCardId;
    }

    if (turnStage !== 'play_or_draw' || !canPlayCard) return false;
    if (!topCard) return false;
    if (card.type === 'wild' || card.type === 'wild_draw4') return true;
    if (card.color === currentColor) return true;
    if (card.type === 'number' && topCard.type === 'number') return card.value === topCard.value;
    return card.type === topCard.type;
  };

  const submit = (action: Action) => onAction(action);

  // Auto Action Timer & State Tracking
  const autoActionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHandledKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const stateKey = `${turn}_${turnStage}`;

    // 1. Auto Pass: After drawing, if still no playable cards, pass immediately
    if (isMyTurn && !readonly && !winner && turnStage === 'must_resolve_drawn' && !canPlayDrawn && canPass) {
      if (lastHandledKeyRef.current !== stateKey) {
        lastHandledKeyRef.current = stateKey;
        submit({ action_id: 'pass_turn', role_id: roleId, params: {} });
      }
      return; // Skip drawing logic if we're in must_resolve_drawn
    }

    // 2. Auto Draw: If no playable cards, wait 3s then draw
    const shouldDraw = isMyTurn && !readonly && !winner && canDraw && actionIds.has('draw_card');

    if (shouldDraw) {
      // Only start timer if state changed or timer is not already running
      if (lastHandledKeyRef.current !== stateKey) {
        if (autoActionTimerRef.current) clearTimeout(autoActionTimerRef.current);

        autoActionTimerRef.current = setTimeout(() => {
          lastHandledKeyRef.current = stateKey;
          submit({ action_id: 'draw_card', role_id: roleId, params: {} });
        }, 800);
      }
    } else {
      // Clear timer if conditions no longer met
      if (autoActionTimerRef.current) {
        clearTimeout(autoActionTimerRef.current);
        autoActionTimerRef.current = null;
      }
    }

    return () => {
      // In a real app, we might want to keep the timer across renders if stateKey is same
      // But in React strict mode or dependency changes, we need to be careful.
      // Here we trust the stateKey check above to prevent reset unless state actually changes.
    };
  }, [isMyTurn, readonly, winner, canDraw, canPass, canPlayDrawn, turnStage, roleId, actionIds, turn]);

  const playCard = (index: number, declaredColor?: UnoColor) => {
    submit({
      action_id: 'play_card',
      role_id: roleId,
      params: {
        cardIndex: index,
        ...(declaredColor ? { declaredColor } : {}),
      },
    });
  };

  const playDrawn = (declaredColor?: UnoColor) => {
    submit({
      action_id: 'play_drawn',
      role_id: roleId,
      params: declaredColor ? { declaredColor } : {},
    });
  };

  const handleCardClick = (card: UnoCard, index: number) => {
    if (!isPlayableCard(card)) return;

    if (turnStage === 'must_resolve_drawn' && card.id === drawnCardId) {
      if (card.type === 'wild' || card.type === 'wild_draw4') {
        setColorModal({ actionId: 'play_drawn' });
        return;
      }
      playDrawn();
      return;
    }

    if (card.type === 'wild' || card.type === 'wild_draw4') {
      setColorModal({ actionId: 'play_card', cardIndex: index });
      return;
    }
    playCard(index);
  };

  const chooseColor = (color: UnoColor) => {
    if (!colorModal) return;
    if (colorModal.actionId === 'play_card' && typeof colorModal.cardIndex === 'number') {
      playCard(colorModal.cardIndex, color);
    } else {
      playDrawn(color);
    }
    setColorModal(null);
  };

  const formatCardLabel = (card: UnoCard): string => {
    if (card.type === 'number') return `${card.value}`;
    if (card.type === 'skip') return '⊘';
    if (card.type === 'reverse') return '⇄';
    if (card.type === 'draw2') return '+2';
    if (card.type === 'wild') return 'W';
    return '+4';
  };

  const renderCard = (
    card: UnoCard,
    playable: boolean,
    onClick?: () => void
  ) => {
    const label = formatCardLabel(card);
    const colorClass = card.color ? styles[`bg_${card.color}`] : styles.bg_wild;
    const textClass = card.color ? styles[`text_${card.color}`] : styles.text_wild;

    return (
      <div
        className={`${styles.card} ${playable ? styles.cardPlayable : styles.cardDisabled}`}
        onClick={playable ? onClick : undefined}
      >
        <div className={`${styles.cardInner} ${colorClass}`}>
          <div className={styles.cardOval}></div>
          <div className={`${styles.cardCorner} ${styles.topLeft}`}>{label}</div>
          <div className={`${styles.cardText} ${textClass}`}>{label}</div>
          <div className={`${styles.cardCorner} ${styles.bottomRight}`}>{label}</div>
        </div>
      </div>
    );
  };

  const renderCardBack = () => (
    <div className={`${styles.card} ${styles.cardBack}`}>
      <div className={styles.cardInner}>
        <div className={styles.cardOval}></div>
        <div className={styles.cardText}>UNO</div>
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      {/* Opponents Area */}
      <div className={styles.opponentsRow}>
        {players.map((pid) => {
          const isActive = pid === currentRole;
          return (
            <div key={pid} className={`${styles.playerAvatar} ${isActive ? styles.active : ''}`}>
              <div className={styles.playerName}>{pid === roleId ? '你' : pid}</div>
              <div className={styles.playerHandCount}>
                <span style={{ fontSize: '1.2rem' }}>🃏</span> x {handCounts[pid] ?? 0}
              </div>
            </div>
          );
        })}
      </div>

      {/* Center Table Area */}
      <div className={styles.tableCenter}>
        {/* Glow effect for current color */}
        <div
          className={styles.currentColorIndicator}
          style={{ background: COLOR_MAP[currentColor] }}
        ></div>

        <div className={styles.tableStatus}>
          {winner ? `WINNER: ${winner}` : `TURN ${turn} | ${direction === 1 ? '↻' : '↺'}`}
        </div>

        <div className={styles.piles}>
          {/* Draw Pile */}
          <div className={styles.pileWrapper}>
            {renderCardBack()}
            <div className={styles.pileLabel}>{drawPileCount} 张</div>
          </div>

          {/* Discard Pile */}
          <div className={styles.pileWrapper}>
            {topCard ? renderCard(topCard, false) : renderCardBack()}
            <div className={styles.pileLabel}>当前牌</div>
          </div>
        </div>
      </div>

      {/* Action Panel (Desktop: Bottom Right, Mobile: Above hand) */}
      <div className={styles.actionsPanel}>
        <button
          className={`${styles.actionBtn} ${styles.drawBtn}`}
          disabled={!canDraw}
          onClick={() => submit({ action_id: 'draw_card', role_id: roleId, params: {} })}
        >
          抓牌
        </button>
        <button
          className={`${styles.actionBtn} ${styles.passBtn}`}
          disabled={!canPass}
          onClick={() => submit({ action_id: 'pass_turn', role_id: roleId, params: {} })}
        >
          过
        </button>
      </div>

      {/* My Hand Area */}
      <div className={styles.myHandSection}>
        <div className={styles.handCards}>
          {yourHand.map((card, index) => (
            <div key={card.id} className={styles.handCardWrapper} style={{ zIndex: index }}>
              {renderCard(
                card,
                isPlayableCard(card),
                () => handleCardClick(card, index)
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Color Picker Modal */}
      {colorModal && (
        <div className={styles.modalMask}>
          <div className={styles.modal}>
            <div className={styles.modalTitle}>选择你要指定的颜色</div>
            <div className={styles.colorGrid}>
              {(Object.keys(COLOR_MAP) as UnoColor[]).map((color) => (
                <button
                  key={color}
                  className={styles.colorPickerBtn}
                  style={{ background: COLOR_MAP[color] }}
                  onClick={() => chooseColor(color)}
                ></button>
              ))}
            </div>
            <button className={styles.cancelBtn} onClick={() => setColorModal(null)}>
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnoUI;
