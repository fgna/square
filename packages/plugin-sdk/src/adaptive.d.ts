/** Runtime-neutral adaptive practice helpers (v1). Domain rules stay in the plugin. */
export interface LadderRules {
  window: number;
  promoteAt: number;
  fastTrack: number;
  struggleWindow: number;
  struggleAt: number;
}
export declare const DEFAULT_LADDER_RULES: Readonly<LadderRules>;

/** One judged trial. `success` means independent: correct first answer, no help. */
export interface LadderTrial {
  level: number;
  success: boolean;
}
export interface LadderState {
  level: number;
  lastChange: 'up' | 'down' | null;
  failureStreak: number;
  successStreak: number;
  current: { trials: number; successes: number };
  /** 0..1 share of the promotion criterion reached at the current level. */
  progress: number;
  levels: Array<{ trials: number; successes: number }>;
}
export declare function replayLadder(
  trials: LadderTrial[],
  levelCount: number,
  options?: { startLevel?: number; rules?: Partial<LadderRules> },
): LadderState;

export interface ReviewTrial {
  key: string;
  success: boolean;
}
export interface DueItem {
  key: string;
  box: number;
  overdue: number;
}
export declare const DEFAULT_REVIEW_SPACING: readonly number[];
export declare function reviewQueue(trials: ReviewTrial[], spacing?: readonly number[]): DueItem[];

export type PlannedTrial =
  | { kind: 'practice' | 'confidence'; level: number }
  | { kind: 'review'; level: number; key: string };
export declare function planNextTrial(input: {
  ladder: Pick<LadderState, 'level' | 'failureStreak'>;
  due?: DueItem[];
  random?: () => number;
  reviewShare?: number;
  confidenceAfter?: number;
}): PlannedTrial;

export declare function personalPace(durationsMs: number[], options?: { min?: number; window?: number }): number | null;
export declare function isBrisk(durationMs: number, pace: number | null, factor?: number): boolean;
export declare function seededRandom(seed: number): () => number;
