import test from 'node:test';
import assert from 'node:assert/strict';
import {STAGES, stagePrefix, sequenceDuration, sequenceFrame, isPostureMotion, reviewTemplate} from '../apps/rinne/src/review/review-contract.js';
import {createPlayback} from '../apps/rinne/src/review/playback.js';
const selection = Object.fromEntries(STAGES.map((name, i) => [name, ['idle', 'slash', 'thrust'][i]]));
for (const [index, id] of STAGES.entries()) test(`${id}: plays exactly the selected prefix`, () => {
  assert.deepEqual(stagePrefix(id, selection), ['idle', 'slash', 'thrust'].slice(0, index + 1));
});
test('missing earlier stages are not silently skipped', () => {
  assert.throws(() => stagePrefix('stage-kyu', {...selection, 'stage-ha': ''}), /破/);
  assert.throws(() => stagePrefix('unknown', selection));
  assert.deepEqual(stagePrefix('stage-jo', {...selection, 'stage-ha': ''}), ['idle']);
});
test('repeated clips remain separate stages', () => {
  assert.deepEqual(stagePrefix('stage-kyu', Object.fromEntries(STAGES.map(s => [s, 'slash']))), ['slash', 'slash', 'slash']);
});
const clips = [{duration: 1}, {duration: 2}, {duration: .5}];
test('sequence duration validates the entire queue', () => {
  assert.equal(sequenceDuration(clips), 3.5);
  assert.equal(sequenceDuration([]), 0);
  for (const duration of [0, -1, Infinity, NaN]) assert.throws(() => sequenceDuration([{duration}]));
});
test('boundaries use next stage and stop on the final frame', () => {
  assert.deepEqual(sequenceFrame(clips, 0), {index: 0, offset: 0, time: 0, duration: 1});
  assert.deepEqual(sequenceFrame(clips, 1), {index: 1, offset: 1, time: 0, duration: 2});
  assert.deepEqual(sequenceFrame(clips, 3), {index: 2, offset: 3, time: 0, duration: .5});
  assert.deepEqual(sequenceFrame(clips, 3.5), {index: 2, offset: 3, time: .5, duration: .5});
  assert.equal(sequenceFrame([], 2), null);
});
test('seek, pause, speed, and loop operate on the whole prefix', () => {
  const clock = createPlayback(); clock.duration = sequenceDuration(clips); clock.loop = false; clock.playing = true;
  for (let i = 0; i < 100; i++) clock.update(.1);
  assert.equal(clock.time, 3.5); assert.equal(clock.playing, false);
  clock.seek(2); assert.equal(sequenceFrame(clips, clock.time).index, 1);
  clock.update(.1); assert.equal(clock.time, 2);
  clock.speed = 2; clock.playing = true; clock.update(.1); assert.equal(clock.time, 2.2);
  clock.seek(3.45); clock.loop = true; clock.playing = true; clock.update(.1);
  assert.ok(Math.abs(clock.time - .15) < 1e-8); assert.equal(sequenceFrame(clips, clock.time).index, 0);
});
for (const name of ['Sword_Draw', 'Sword_Unsheathe', '抜刀', 'Sword_Equip']) test(`draw classification: ${name}`, () => {
  assert.ok(isPostureMotion('draw', name)); assert.ok(!isPostureMotion('sheathe', name));
});
for (const name of ['Sword_Sheath', 'Sword_Unequip', '納刀']) test(`sheathe classification: ${name}`, () => {
  assert.ok(isPostureMotion('sheathe', name)); assert.ok(!isPostureMotion('draw', name));
});
test('does not relabel bow draw, attack, or stance as draw/sheath', () => {
  for (const name of ['Bow_Draw', 'Crossbow_Draw', 'Sword_Attack', '構え / 静の構え', '技 / 居合い抜き', 'Idle']) {
    assert.ok(!isPostureMotion('draw', name)); assert.ok(!isPostureMotion('sheathe', name));
  }
});
test('feedback includes target, build, composition, and editable sections', () => {
  const output = reviewTemplate({target: '破', motion: 'slash', build: 'abc123', composition: '序=idle → 破=slash'});
  for (const value of ['確認結果: 要修正', '対象: 破', '対象モーション: slash', 'Build: abc123', '序=idle → 破=slash', '【現在の見え方・問題点】']) assert.ok(output.includes(value));
});
test('approval copies a distinct affirmative result, not a negative draft', () => {
  const output = reviewTemplate({target: '急'}, {approved: true, note: '腕がおかしい'});
  assert.ok(output.includes('確認結果: 確認OK')); assert.ok(output.includes('修正不要'));
  assert.ok(!output.includes('要修正')); assert.ok(!output.includes('腕がおかしい'));
});
