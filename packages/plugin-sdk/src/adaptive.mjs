/**
 * Runtime-neutral adaptive practice helpers; can be consumed by any Square plugin.
 *
 * Domain-free: a plugin defines its own ordered levels, items and what counts
 * as a successful trial. These helpers only decide *where* to practise next so
 * that learners stay in a band where most trials succeed: promote after stable
 * success, step back after repeated failure, bring failed items back with
 * growing spacing, and never punish a slow but correct answer.
 *
 * All functions are pure and deterministic for a given input (pass `random`).
 */

export const DEFAULT_LADDER_RULES = Object.freeze({
  /** Trials at the current level considered for promotion. */
  window: 6,
  /** Successes within `window` needed to move up. */
  promoteAt: 5,
  /** Consecutive successes on a fresh level that skip ahead early (0 disables). */
  fastTrack: 3,
  /** Trials at the current level considered for stepping back. */
  struggleWindow: 4,
  /** Failures within `struggleWindow` that step back one level. */
  struggleAt: 3,
});

function checkRules(rules) {
  const r = { ...DEFAULT_LADDER_RULES, ...rules };
  for (const key of Object.keys(DEFAULT_LADDER_RULES)) {
    if (!Number.isSafeInteger(r[key]) || r[key] < 0) throw new TypeError('invalid_ladder_rules');
  }
  if (r.window < 1 || r.promoteAt < 1 || r.promoteAt > r.window
    || r.struggleWindow < 1 || r.struggleAt < 1 || r.struggleAt > r.struggleWindow) {
    throw new TypeError('invalid_ladder_rules');
  }
  return r;
}

function checkTrial(trial, levelCount) {
  if (!trial || typeof trial !== 'object' || !Number.isSafeInteger(trial.level)
    || trial.level < 0 || trial.level >= levelCount || typeof trial.success !== 'boolean') {
    throw new TypeError('invalid_trial');
  }
}

/**
 * Replays chronological trials `{ level, success }` over `levelCount` ordered
 * levels and returns the learner's current level. A trial is a success only
 * when the plugin judges it independent (e.g. first answer correct, no hint).
 *
 * Trials at other levels (reviews, confidence items) are counted in `levels`
 * but never move the ladder. `startLevel` (e.g. from a placement) is where the
 * replay begins; the level stays within 0 and the last level.
 */
export function replayLadder(trials, levelCount, options = {}) {
  if (!Array.isArray(trials) || !Number.isSafeInteger(levelCount) || levelCount < 1) {
    throw new TypeError('invalid_ladder');
  }
  const rules = checkRules(options.rules);
  const start = options.startLevel ?? 0;
  if (!Number.isSafeInteger(start) || start < 0 || start >= levelCount) throw new TypeError('invalid_ladder');
  const levels = Array.from({ length: levelCount }, () => ({ trials: 0, successes: 0 }));
  let level = start;
  let recent = [];
  let freshStint = true;
  let lastChange = null;
  let failureStreak = 0;
  let successStreak = 0;
  for (const trial of trials) {
    checkTrial(trial, levelCount);
    levels[trial.level].trials += 1;
    if (trial.success) levels[trial.level].successes += 1;
    failureStreak = trial.success ? 0 : failureStreak + 1;
    successStreak = trial.success ? successStreak + 1 : 0;
    if (trial.level !== level) continue;
    recent.push(trial.success);
    if (!trial.success) freshStint = false;
    const tail = recent.slice(-rules.window);
    const fast = rules.fastTrack > 0 && freshStint && recent.length === rules.fastTrack;
    const steady = tail.length === rules.window && tail.filter(Boolean).length >= rules.promoteAt;
    const struggle = recent.slice(-rules.struggleWindow);
    if ((fast || steady) && level < levelCount - 1) {
      level += 1; recent = []; freshStint = true; lastChange = 'up';
    } else if (struggle.length === rules.struggleWindow
      && struggle.filter(s => !s).length >= rules.struggleAt && level > 0) {
      // Stepping back is not a reset: the next promotion needs fresh evidence
      // only, and the plugin keeps every earlier success.
      level -= 1; recent = []; freshStint = false; lastChange = 'down';
    }
  }
  const tail = recent.slice(-rules.window);
  return {
    level,
    lastChange,
    failureStreak,
    successStreak,
    /** Successes and trials at the current level since the last change. */
    current: { trials: recent.length, successes: recent.filter(Boolean).length },
    /** 0..1 share of the promotion criterion reached (for progress displays). */
    progress: Math.min(1, tail.filter(Boolean).length / rules.promoteAt),
    levels,
  };
}

/** Default spacing in trials before a failed item returns: 1, 3, 7, 15. */
export const DEFAULT_REVIEW_SPACING = Object.freeze([1, 3, 7, 15]);

/**
 * Spaced review queue (Leitner-style, counted in trials rather than days, so
 * it also works inside a single session). Chronological trials
 * `{ key, success }`; an item enters review after its first failure, moves one
 * box up per later success and back to box 0 on failure. It leaves the queue
 * after a success in the last box. Returns due keys, most overdue first.
 */
export function reviewQueue(trials, spacing = DEFAULT_REVIEW_SPACING) {
  if (!Array.isArray(trials) || !Array.isArray(spacing) || spacing.length < 1
    || spacing.some(n => !Number.isSafeInteger(n) || n < 0)) {
    throw new TypeError('invalid_review');
  }
  const items = new Map();
  trials.forEach((trial, index) => {
    if (!trial || typeof trial.key !== 'string' || !trial.key || typeof trial.success !== 'boolean') {
      throw new TypeError('invalid_trial');
    }
    const item = items.get(trial.key);
    if (!trial.success) items.set(trial.key, { box: 0, seen: index });
    else if (item) {
      if (item.box + 1 >= spacing.length) items.delete(trial.key);
      else items.set(trial.key, { box: item.box + 1, seen: index });
    }
  });
  const now = trials.length;
  return [...items.entries()]
    .map(([key, item]) => ({ key, box: item.box, overdue: now - 1 - item.seen - spacing[item.box] }))
    .filter(item => item.overdue >= 0)
    .sort((a, b) => b.overdue - a.overdue || a.key.localeCompare(b.key));
}

/**
 * Plans the next trial: `practice` at the current level, `confidence` one
 * level below after `failureStreak` failures in a row (an easy success before
 * the next challenge), or `review` of a due item with probability
 * `reviewShare`. `random` returns [0, 1).
 */
export function planNextTrial({ ladder, due = [], random = Math.random, reviewShare = 0.25, confidenceAfter = 2 }) {
  if (!ladder || !Number.isSafeInteger(ladder.level) || typeof random !== 'function'
    || !(reviewShare >= 0 && reviewShare <= 1) || !Number.isSafeInteger(confidenceAfter) || confidenceAfter < 1) {
    throw new TypeError('invalid_plan');
  }
  if (ladder.failureStreak >= confidenceAfter) {
    return { kind: 'confidence', level: Math.max(0, ladder.level - 1) };
  }
  if (due.length > 0 && random() < reviewShare) return { kind: 'review', level: ladder.level, key: due[0].key };
  return { kind: 'practice', level: ladder.level };
}

/**
 * The learner's own typical response time: the median of the last `window`
 * successful durations in milliseconds, or null with fewer than `min` samples.
 * Compare learners only with themselves; never show this as a countdown.
 */
export function personalPace(durationsMs, { min = 5, window = 20 } = {}) {
  if (!Array.isArray(durationsMs)) throw new TypeError('invalid_pace');
  const usable = durationsMs.filter(ms => Number.isFinite(ms) && ms > 0).slice(-window).sort((a, b) => a - b);
  if (usable.length < min) return null;
  const mid = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[mid] : (usable[mid - 1] + usable[mid]) / 2;
}

/** True when a successful answer was clearly quicker than the learner's own pace. */
export function isBrisk(durationMs, pace, factor = 0.8) {
  return pace !== null && Number.isFinite(durationMs) && durationMs > 0 && durationMs <= pace * factor;
}

/** Small deterministic PRNG (mulberry32) for reproducible item selection and tests. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
