export type Identity =
  | 'werewolf'
  | 'seer'
  | 'witch'
  | 'hunter'
  | 'guard'
  | 'villager';

export type Camp = 'werewolf' | 'villager';

export type Phase = 'night' | 'day_discussion' | 'day_voting' | 'last_words' | 'hunter_shoot' | 'game_over';

export type NightSubPhase = 'guard' | 'werewolf' | 'seer' | 'witch' | null;

export interface DeathRecord {
  day: number;
  phase: 'night' | 'day_voting' | 'hunter_shoot';
  victim: string;
  cause: 'werewolf' | 'poison' | 'vote' | 'hunter';
  details?: string;
}

export interface NightRecord {
  night: number;
  guard_target: string | null;
  werewolf_target: string | null;
  werewolf_killed: string | null;
  seer_check: { target: string; result: 'werewolf' | 'good' } | null;
  witch_actions: {
    saved: boolean;
    poisoned: string | null;
  };
}

export interface VoteRecord {
  day: number;
  votes: Array<{ voter: string; target: string }>;
  exiled: string | null;
}

export interface SpeechRecord {
  day: number;
  speaker: string;
  content: string;
  timestamp: string;
}

export interface LastWordsRecord {
  day: number;
  speaker: string;
  content: string;
  timestamp: string;
}

export interface WerewolfState {
  players: string[];
  playerCount: number;
  identities: Record<string, Identity>;
  day: number;
  phase: Phase;
  nightSubPhase: NightSubPhase;
  pendingRoles: string[];
  alive: Record<string, boolean>;
  dead_players: Record<string, Identity>;
  alive_identity: Record<Identity, number>;
  currentNightActions: {
    guard_target: string | null;
    werewolf_votes: Record<string, string>;
    werewolf_target: string | null;
    seer_target: string | null;
    seer_result: 'werewolf' | 'good' | null;
    witch_save: boolean;
    witch_poison_target: string | null;
  };
  currentDayVotes: Record<string, string>;
  witchPotions: {
    antidote_used: boolean;
    poison_used: boolean;
  };
  lastGuardTarget: string | null;
  hunterAlive: boolean;
  hunterCanShoot: boolean;
  deathHistory: DeathRecord[];
  nightHistory: NightRecord[];
  voteHistory: VoteRecord[];
  speechHistory: SpeechRecord[];
  lastNightDeaths: DeathRecord[];
  lastDayExile: string | null;
  hunterShootContext: {
    resumePhase: 'day_discussion' | 'night';
    queuedDeaths: DeathRecord[];
  } | null;
  lastWordsHistory: LastWordsRecord[];
  lastWordsContext: {
    pendingDeaths: DeathRecord[];
    resumePhase: 'day_discussion' | 'night';
    completedLastWords: string[];
  } | null;
  winner: Camp | null;
}
