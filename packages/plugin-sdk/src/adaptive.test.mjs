import { test } from 'node:test';
import assert from 'node:assert/strict';
import { replayLadder, reviewQueue, planNextTrial, personalPace, isBrisk, seededRandom } from './adaptive.mjs';

const at = (level, ...outcomes) => outcomes.map(success => ({ level, success }));

test('fresh level: three independent successes fast-track upwards', () => {
  const state = replayLadder(at(0, true, true, true), 4);
  assert.equal(state.level, 1);
  assert.equal(state.lastChange, 'up');
  assert.deepEqual(state.current, { trials: 0, successes: 0 });
});

test('after a failure, promotion needs 5 of the last 6', () => {
  const trials = at(0, false, true, true, true, true);
  assert.equal(replayLadder(trials, 4).level, 0);
  assert.equal(replayLadder([...trials, { level: 0, success: true }], 4).level, 1);
});

test('three failures in four trials step back exactly one level', () => {
  const trials = [...at(0, true, true, true), ...at(1, false, true, false, false)];
  const state = replayLadder(trials, 4);
  assert.equal(state.level, 0);
  assert.equal(state.lastChange, 'down');
  assert.equal(state.failureStreak, 2);
});

test('never below 0, never above the last level', () => {
  assert.equal(replayLadder(at(0, false, false, false, false, false), 3).level, 0);
  assert.equal(replayLadder([...at(0, true, true, true), ...at(1, true, true, true), ...at(2, true, true, true)], 3).level, 2);
});

test('trials at other levels count in stats but do not move the ladder', () => {
  const state = replayLadder([...at(0, true, true, true), ...at(0, false, false, false, false)], 3);
  assert.equal(state.level, 1);
  assert.deepEqual(state.levels[0], { trials: 7, successes: 3 });
});

test('start level and rules are honoured and validated', () => {
  assert.equal(replayLadder([], 5, { startLevel: 3 }).level, 3);
  assert.equal(replayLadder(at(0, true, true, true), 3, { rules: { fastTrack: 0 } }).level, 0);
  assert.throws(() => replayLadder([], 3, { startLevel: 3 }), /invalid_ladder/);
  assert.throws(() => replayLadder([], 3, { rules: { promoteAt: 9 } }), /invalid_ladder_rules/);
  assert.throws(() => replayLadder([{ level: 7, success: true }], 3), /invalid_trial/);
  assert.throws(() => replayLadder([{ level: 0, success: 'yes' }], 3), /invalid_trial/);
});

test('progress reports share of the promotion criterion', () => {
  assert.equal(replayLadder(at(0, false, true, true), 3).progress, 2 / 5);
});

test('review queue spaces failed items and releases them after the last box', () => {
  const fail = { key: 'a', success: false };
  const filler = n => Array.from({ length: n }, (_, i) => ({ key: 'x' + i, success: true }));
  assert.deepEqual(reviewQueue([fail]), []);
  assert.deepEqual(reviewQueue([fail, ...filler(1)]).map(d => d.key), ['a']);
  const afterOne = [fail, ...filler(1), { key: 'a', success: true }];
  assert.deepEqual(reviewQueue([...afterOne, ...filler(2)]), []);
  assert.deepEqual(reviewQueue([...afterOne, ...filler(3)]).map(d => [d.key, d.box]), [['a', 1]]);
  assert.deepEqual(reviewQueue([fail, { key: 'a', success: true }], [1]), []);
  assert.deepEqual(reviewQueue([{ key: 'b', success: true }, ...filler(5)]), [], 'never-failed items are not queued');
  assert.throws(() => reviewQueue([{ key: '', success: false }]), /invalid_trial/);
});

test('plan: confidence after a failure streak, review by share, else practice', () => {
  assert.deepEqual(planNextTrial({ ladder: { level: 2, failureStreak: 2 } }), { kind: 'confidence', level: 1 });
  assert.deepEqual(planNextTrial({ ladder: { level: 0, failureStreak: 3 } }), { kind: 'confidence', level: 0 });
  const due = [{ key: 'k', box: 0, overdue: 2 }];
  assert.deepEqual(planNextTrial({ ladder: { level: 1, failureStreak: 0 }, due, random: () => 0.1 }), { kind: 'review', level: 1, key: 'k' });
  assert.deepEqual(planNextTrial({ ladder: { level: 1, failureStreak: 0 }, due, random: () => 0.9 }), { kind: 'practice', level: 1 });
  assert.deepEqual(planNextTrial({ ladder: { level: 1, failureStreak: 0 }, random: () => 0 }), { kind: 'practice', level: 1 });
});

test('personal pace is a median of own successes; brisk is relative', () => {
  assert.equal(personalPace([1000, 2000]), null);
  assert.equal(personalPace([5000, 1000, 3000, 2000, 4000]), 3000);
  assert.equal(personalPace([1000, 2000, 3000, 4000, 5000, 6000]), 3500);
  assert.equal(personalPace([NaN, -1, 1000, 1000, 1000, 1000, 1000]), 1000);
  assert.equal(isBrisk(2000, 3000), true);
  assert.equal(isBrisk(2900, 3000), false);
  assert.equal(isBrisk(100, null), false);
});

test('seeded random is deterministic and in range', () => {
  const a = seededRandom(42), b = seededRandom(42);
  const xs = Array.from({ length: 100 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 100 }, () => b()));
  assert.ok(xs.every(x => x >= 0 && x < 1));
});
