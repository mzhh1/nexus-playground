import {
  Action,
  ActionResult,
  ActionSpec,
  GameLogic,
  GameMetadata,
  GameState,
  HistoryEvent,
  InitContext,
  RolePerspective,
  isSpectator as isSpectatorRole,
} from '@nexus/game-sdk';

type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
type UnoCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild_draw4';
type TurnStage = 'play_or_draw' | 'must_resolve_drawn';

interface UnoCard {
  id: string;
  type: UnoCardType;
  color: UnoColor | null;
  value?: number;
}

interface UnoState extends GameState {
  players: string[];
  hands: Record<string, UnoCard[]>;
  drawPile: UnoCard[];
  discardPile: UnoCard[];
  currentRole: string;
  direction: 1 | -1;
  turn: number;
  winner: string | null;
  currentColor: UnoColor;
  turnStage: TurnStage;
  drawnCardId: string | null;
}

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

export class UnoLogic implements GameLogic {
  getMetadata(): GameMetadata {
    return {
      id: 'uno',
      name: 'UNO',
      description:
        '经典简化 UNO：按颜色/数字/功能牌匹配出牌，支持 Skip、Reverse、Draw Two、Wild、Wild Draw Four。首位出完手牌即获胜。',
      minPlayers: 2,
      maxPlayers: 10,
      roleIds: this.buildRoleIdsConfig(),
      enable_llm_memory: false,
      getStatusText: (perspective: RolePerspective) => {
        const state = perspective.current_state as {
          winner: string | null;
          turn: number;
          currentRole: string;
        };
        if (state.winner) {
          return `游戏结束 - ${state.winner} 获胜`;
        }
        return `第 ${state.turn} 回合 - 轮到 ${state.currentRole}`;
      },
    };
  }

  initState(ctx: InitContext): GameState {
    const playerCount = ctx.players.length;
    if (playerCount < 2 || playerCount > 10) {
      throw new Error('UNO requires 2-10 players');
    }

    const drawPile = this.shuffle(this.createDeck());
    const hands: Record<string, UnoCard[]> = {};
    for (const roleId of ctx.players) {
      hands[roleId] = [];
    }

    for (let i = 0; i < 7; i++) {
      for (const roleId of ctx.players) {
        const card = drawPile.pop();
        if (!card) throw new Error('Deck exhausted while dealing');
        hands[roleId].push(card);
      }
    }

    const discardPile: UnoCard[] = [];
    let openingCard: UnoCard | undefined;
    for (let guard = 0; guard < 50; guard++) {
      const card = drawPile.pop();
      if (!card) break;
      if (card.type === 'wild_draw4') {
        drawPile.unshift(card);
        continue;
      }
      openingCard = card;
      break;
    }
    if (!openingCard) throw new Error('Failed to pick opening card');
    discardPile.push(openingCard);

    const state: UnoState = {
      players: [...ctx.players],
      hands,
      drawPile,
      discardPile,
      currentRole: ctx.players[0],
      direction: 1,
      turn: 1,
      winner: null,
      currentColor: openingCard.color ?? this.randomColor(),
      turnStage: 'play_or_draw',
      drawnCardId: null,
    };

    this.applyOpeningCardEffect(state, openingCard);
    return state;
  }

  getCurrentRole(state: GameState): string {
    return (state as UnoState).currentRole;
  }

  getLegalActions(state: GameState, roleId: string): ActionSpec {
    const s = state as UnoState;
    if (isSpectatorRole(roleId) || s.winner || s.currentRole !== roleId) {
      return { actions: [] };
    }

    if (s.turnStage === 'must_resolve_drawn') {
      const actions: NonNullable<ActionSpec['actions']> = [];
      const hand = s.hands[roleId] ?? [];
      const drawnCard = hand.find((card) => card.id === s.drawnCardId);
      if (drawnCard && this.canPlayCard(drawnCard, s)) {
        actions.push({
          action_id: 'play_drawn',
          description: '打出刚抽到的牌',
          params_schema: {
            declaredColor: {
              type: 'string',
              enum: COLORS,
              description: '仅当打出 Wild / Wild Draw Four 时需要',
            },
          },
        });
      }
      actions.push({
        action_id: 'pass_turn',
        description: '结束本回合',
        params_schema: null,
      });
      return { actions };
    }

    const hand = s.hands[roleId] ?? [];
    const playableIndices = hand
      .map((card, index) => ({ card, index }))
      .filter((entry) => this.canPlayCard(entry.card, s))
      .map((entry) => entry.index);

    const actions: NonNullable<ActionSpec['actions']> = [];
    if (playableIndices.length > 0) {
      actions.push({
        action_id: 'play_card',
        description: '打出一张合法手牌',
        params_schema: {
          type: 'object',
          properties: {
            cardIndex: {
              type: 'integer',
              minimum: 0,
              maximum: Math.max(0, hand.length - 1),
            },
            declaredColor: {
              type: 'string',
              enum: COLORS,
              description: '仅当打出 Wild / Wild Draw Four 时需要',
            },
          },
          required: ['cardIndex'],
          additionalProperties: false,
        },
      });
    } else {
      actions.push({
        action_id: 'draw_card',
        description: '无牌可出，抽一张牌',
        params_schema: null,
      });
    }
    return { actions };
  }

  applyAction(state: GameState, action: Action): ActionResult {
    const s = JSON.parse(JSON.stringify(state)) as UnoState;

    if (s.winner) {
      return { success: false, error: '游戏已结束', errorCode: 'GAME_FINISHED' };
    }
    if (s.currentRole !== action.role_id) {
      return { success: false, error: '不是你的回合', errorCode: 'NOT_YOUR_TURN' };
    }

    if (s.turnStage === 'play_or_draw') {
      if (action.action_id === 'draw_card') {
        if (this.hasPlayableCard(s, action.role_id)) {
          return {
            success: false,
            error: '你有可出的牌，不能抽牌',
            errorCode: 'DRAW_NOT_ALLOWED_WHEN_PLAYABLE',
          };
        }
        const drawn = this.drawCards(s, action.role_id, 1)[0];
        if (!drawn) {
          return { success: false, error: '牌堆为空，无法抽牌', errorCode: 'EMPTY_DRAW_PILE' };
        }
        s.drawnCardId = drawn.id;
        s.turnStage = 'must_resolve_drawn';
        return { success: true, nextState: s };
      }

      if (action.action_id !== 'play_card') {
        return { success: false, error: '当前阶段只能出牌或抽牌', errorCode: 'INVALID_ACTION' };
      }

      const hand = s.hands[action.role_id] ?? [];
      const cardIndex = this.readCardIndex(action.params);
      if (cardIndex === null || cardIndex < 0 || cardIndex >= hand.length) {
        return { success: false, error: 'cardIndex 无效', errorCode: 'INVALID_PARAMS' };
      }

      const card = hand[cardIndex];
      if (!this.canPlayCard(card, s)) {
        return { success: false, error: '该牌当前不可打出', errorCode: 'ILLEGAL_CARD' };
      }

      hand.splice(cardIndex, 1);
      const declaredColor = this.readDeclaredColor(action.params);
      if ((card.type === 'wild' || card.type === 'wild_draw4') && !declaredColor) {
        return { success: false, error: '万能牌必须声明颜色', errorCode: 'MISSING_DECLARED_COLOR' };
      }
      if (card.type !== 'wild' && card.type !== 'wild_draw4' && declaredColor) {
        return { success: false, error: '仅万能牌可声明颜色', errorCode: 'UNEXPECTED_DECLARED_COLOR' };
      }

      this.resolvePlayedCard(s, action.role_id, card, declaredColor);
      return { success: true, nextState: s };
    }

    if (action.action_id === 'pass_turn') {
      s.drawnCardId = null;
      s.turnStage = 'play_or_draw';
      this.advanceTurn(s, action.role_id, 1);
      s.turn += 1;
      return { success: true, nextState: s };
    }

    if (action.action_id !== 'play_drawn') {
      return { success: false, error: '当前阶段只能打出刚抽的牌或过牌', errorCode: 'INVALID_ACTION' };
    }

    const hand = s.hands[action.role_id] ?? [];
    const cardIndex = hand.findIndex((card) => card.id === s.drawnCardId);
    if (cardIndex < 0) {
      return { success: false, error: '未找到刚抽到的牌', errorCode: 'DRAWN_CARD_NOT_FOUND' };
    }

    const card = hand[cardIndex];
    if (!this.canPlayCard(card, s)) {
      return { success: false, error: '刚抽到的牌不可打出', errorCode: 'DRAWN_CARD_NOT_PLAYABLE' };
    }

    hand.splice(cardIndex, 1);
    const declaredColor = this.readDeclaredColor(action.params);
    if ((card.type === 'wild' || card.type === 'wild_draw4') && !declaredColor) {
      return { success: false, error: '万能牌必须声明颜色', errorCode: 'MISSING_DECLARED_COLOR' };
    }
    if (card.type !== 'wild' && card.type !== 'wild_draw4' && declaredColor) {
      return { success: false, error: '仅万能牌可声明颜色', errorCode: 'UNEXPECTED_DECLARED_COLOR' };
    }

    this.resolvePlayedCard(s, action.role_id, card, declaredColor);
    return { success: true, nextState: s };
  }

  isTerminal(state: GameState): boolean {
    return (state as UnoState).winner !== null;
  }

  getWinners(state: GameState): string[] | null {
    const winner = (state as UnoState).winner;
    return winner ? [winner] : null;
  }

  toRolePerspective(
    state: GameState,
    roleId: string,
    wholeHistory: HistoryEvent[],
    diffHistory: HistoryEvent[]
  ): RolePerspective {
    const s = state as UnoState;
    const isSpectator = isSpectatorRole(roleId);
    const topCard = s.discardPile[s.discardPile.length - 1];

    const handCounts: Record<string, number> = {};
    for (const pid of s.players) {
      handCounts[pid] = s.hands[pid]?.length ?? 0;
    }

    return {
      global_rules: this.getMetadata().description,
      whole_history: wholeHistory,
      diff_history: diffHistory,
      current_state: {
        players: s.players,
        currentRole: s.currentRole,
        direction: s.direction,
        turn: s.turn,
        winner: s.winner,
        currentColor: s.currentColor,
        topCard,
        drawPileCount: s.drawPile.length,
        discardPileCount: s.discardPile.length,
        handCounts,
        yourHand: isSpectator ? [] : s.hands[roleId] ?? [],
        turnStage: s.turnStage,
        drawnCardId: s.drawnCardId,
      },
      your_role: {
        identity: isSpectator ? 'Spectator (观战者)' : roleId,
        goal: isSpectator ? '观战并理解对局节奏。' : '尽快出完手牌以获胜。',
        is_current: !isSpectator && s.currentRole === roleId,
      },
      action_space_definition: this.getLegalActions(state, roleId),
      message: this.buildMessage(s, roleId),
    };
  }

  generateStatePrompt(perspective: RolePerspective): string {
    const state = perspective.current_state as {
      currentRole: string;
      turn: number;
      currentColor: UnoColor;
      topCard: UnoCard;
      handCounts: Record<string, number>;
      yourHand: UnoCard[];
    };
    const handText = (state.yourHand ?? [])
      .map((card) => this.describeCard(card))
      .join(', ');
    return `# UNO 状态\n回合: ${state.turn}\n当前玩家: ${state.currentRole}\n当前颜色: ${state.currentColor}\n顶部牌: ${this.describeCard(
      state.topCard
    )}\n手牌数: ${JSON.stringify(state.handCounts)}\n你的手牌: ${handText || 'N/A'}`;
  }

  private resolvePlayedCard(
    state: UnoState,
    actorRole: string,
    card: UnoCard,
    declaredColor?: UnoColor
  ): void {
    state.discardPile.push(card);
    state.currentColor = card.color ?? declaredColor ?? state.currentColor;
    state.drawnCardId = null;
    state.turnStage = 'play_or_draw';

    const actorHand = state.hands[actorRole] ?? [];
    if (actorHand.length === 0) {
      state.winner = actorRole;
      return;
    }

    if (card.type === 'number' || card.type === 'wild') {
      this.advanceTurn(state, actorRole, 1);
      state.turn += 1;
      return;
    }

    if (card.type === 'skip') {
      this.advanceTurn(state, actorRole, 2);
      state.turn += 1;
      return;
    }

    if (card.type === 'reverse') {
      if (state.players.length === 2) {
        this.advanceTurn(state, actorRole, 2);
      } else {
        state.direction = state.direction === 1 ? -1 : 1;
        this.advanceTurn(state, actorRole, 1);
      }
      state.turn += 1;
      return;
    }

    if (card.type === 'draw2' || card.type === 'wild_draw4') {
      const drawCount = card.type === 'draw2' ? 2 : 4;
      const targetRole = this.getRoleAtOffset(state, actorRole, 1);
      this.drawCards(state, targetRole, drawCount);
      this.advanceTurn(state, actorRole, 2);
      state.turn += 1;
    }
  }

  private applyOpeningCardEffect(state: UnoState, openingCard: UnoCard): void {
    if (openingCard.type === 'number' || openingCard.type === 'wild') return;

    const firstRole = state.currentRole;
    if (openingCard.type === 'skip') {
      this.advanceTurn(state, firstRole, 1);
      return;
    }

    if (openingCard.type === 'reverse') {
      if (state.players.length === 2) {
        this.advanceTurn(state, firstRole, 1);
      } else {
        state.direction = -1;
        this.advanceTurn(state, firstRole, 1);
      }
      return;
    }

    if (openingCard.type === 'draw2') {
      this.drawCards(state, firstRole, 2);
      this.advanceTurn(state, firstRole, 1);
    }
  }

  private advanceTurn(state: UnoState, fromRole: string, offset: number): void {
    state.currentRole = this.getRoleAtOffset(state, fromRole, offset);
  }

  private getRoleAtOffset(state: UnoState, fromRole: string, offset: number): string {
    const total = state.players.length;
    const fromIndex = state.players.indexOf(fromRole);
    if (fromIndex < 0) return state.currentRole;
    const rawIndex = fromIndex + state.direction * offset;
    const nextIndex = ((rawIndex % total) + total) % total;
    return state.players[nextIndex];
  }

  private drawCards(state: UnoState, roleId: string, count: number): UnoCard[] {
    const hand = state.hands[roleId];
    if (!hand) return [];

    const drawn: UnoCard[] = [];
    for (let i = 0; i < count; i++) {
      if (state.drawPile.length === 0) {
        this.replenishDrawPile(state);
      }
      const card = state.drawPile.pop();
      if (!card) break;
      hand.push(card);
      drawn.push(card);
    }
    return drawn;
  }

  private replenishDrawPile(state: UnoState): void {
    if (state.discardPile.length <= 1) return;
    const top = state.discardPile[state.discardPile.length - 1];
    const rest = state.discardPile.slice(0, -1);
    state.discardPile = [top];
    state.drawPile = this.shuffle(rest);
  }

  private canPlayCard(card: UnoCard, state: UnoState): boolean {
    if (card.type === 'wild' || card.type === 'wild_draw4') return true;

    const topCard = state.discardPile[state.discardPile.length - 1];
    if (!topCard) return false;

    if (card.color && card.color === state.currentColor) return true;

    if (card.type === 'number' && topCard.type === 'number') {
      return card.value === topCard.value;
    }

    return card.type === topCard.type;
  }

  private readCardIndex(params: unknown): number | null {
    if (!params || typeof params !== 'object') return null;
    const value = (params as { cardIndex?: unknown }).cardIndex;
    return typeof value === 'number' && Number.isInteger(value) ? value : null;
  }

  private readDeclaredColor(params: unknown): UnoColor | undefined {
    if (!params || typeof params !== 'object') return undefined;
    const value = (params as { declaredColor?: unknown }).declaredColor;
    return value === 'red' || value === 'yellow' || value === 'green' || value === 'blue'
      ? value
      : undefined;
  }

  private createDeck(): UnoCard[] {
    const deck: UnoCard[] = [];
    let seq = 0;
    const makeCard = (type: UnoCardType, color: UnoColor | null, value?: number): UnoCard => ({
      id: `c_${seq++}`,
      type,
      color,
      value,
    });

    for (const color of COLORS) {
      deck.push(makeCard('number', color, 0));
      for (let n = 1; n <= 9; n++) {
        deck.push(makeCard('number', color, n));
        deck.push(makeCard('number', color, n));
      }
      deck.push(makeCard('skip', color));
      deck.push(makeCard('skip', color));
      deck.push(makeCard('reverse', color));
      deck.push(makeCard('reverse', color));
      deck.push(makeCard('draw2', color));
      deck.push(makeCard('draw2', color));
    }

    for (let i = 0; i < 4; i++) {
      deck.push(makeCard('wild', null));
      deck.push(makeCard('wild_draw4', null));
    }

    return deck;
  }

  private shuffle<T>(items: T[]): T[] {
    const arr = [...items];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = arr[i];
      arr[i] = arr[j];
      arr[j] = temp;
    }
    return arr;
  }

  private randomColor(): UnoColor {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  private describeCard(card: UnoCard | undefined): string {
    if (!card) return '未知';
    if (card.type === 'number') return `${card.color} ${card.value}`;
    if (card.type === 'wild') return 'wild';
    if (card.type === 'wild_draw4') return 'wild+4';
    return `${card.color} ${card.type}`;
  }

  private buildRoleIdsConfig(): Record<number, string[]> {
    const config: Record<number, string[]> = {};
    for (let count = 2; count <= 10; count++) {
      config[count] = Array.from({ length: count }, (_, i) => `player_${i + 1}`);
    }
    return config;
  }

  private buildMessage(state: UnoState, roleId: string): string {
    if (state.winner) {
      return state.winner === roleId ? '🎉 你赢了！' : `🏁 对局结束，${state.winner} 获胜`;
    }
    const topCard = state.discardPile[state.discardPile.length - 1];
    const topCardText = this.describeCard(topCard);
    if (isSpectatorRole(roleId)) {
      return `👀 观战中：轮到 ${state.currentRole}，当前颜色 ${state.currentColor}，顶部牌 ${topCardText}`;
    }
    if (state.currentRole === roleId) {
      if (state.turnStage === 'must_resolve_drawn') {
        return `✨ 你已抽牌，可选择打出刚抽到的牌或过牌。当前颜色 ${state.currentColor}`;
      }
      if (!this.hasPlayableCard(state, roleId)) {
        return `⚠️ 你当前无可出牌，请先抽一张牌。当前颜色 ${state.currentColor}`;
      }
      return `✨ 轮到你出牌。当前颜色 ${state.currentColor}，顶部牌 ${topCardText}`;
    }
    return `⏳ 等待 ${state.currentRole} 行动中...`;
  }

  private hasPlayableCard(state: UnoState, roleId: string): boolean {
    const hand = state.hands[roleId] ?? [];
    return hand.some((card) => this.canPlayCard(card, state));
  }
}

export default new UnoLogic();
