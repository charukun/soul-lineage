import test from 'node:test';
import assert from 'node:assert/strict';
import { canonical, copy, digest, checkSimulation, checkRetention, indexMachine } from '../scripts/rrp-evolution/finite.mjs';
import { lifeTables, semanticEvidence, historicalVerdict, patchName, replaceKnownFields, validNewActor } from '../scripts/rrp-evolution/examples.mjs';
import { rawCommand, transition, initialOwner } from '../scripts/rrp-evolution/cutover.mjs';
import { initialModel, step, transact } from '../scripts/rrp-evolution/exploration.mjs';

const mutation = process.env.RRP_EVOLUTION_MUTATION ?? 'none';
function safe(model) {
  assert.deepEqual(model.oracle.errors, [], `INVARIANT: ${model.oracle.errors.join('; ')}`);
  return model;
}
const tx = (m, kind, extra = {}) => safe(transact(m, kind, extra, mutation));
const ev = (m, event) => safe(step(m, event, mutation));
function copyRows(model) {
  return tx(tx(tx(model, 'begin'), 'copy', { key: 'a' }), 'copy', { key: 'b' });
}
function finish(model) {
  let m = tx(model, 'seal');
  while (m.local.disk.migration.cursor < m.local.disk.migration.cut) m = tx(m, 'replay');
  m = tx(m, 'activate');
  assert.equal(m.local.disk.active, 2, 'LIVENESS: directed fair migration completion');
  return m;
}

test('closed life algebra: all old operations simulate under the new representation', () => {
  const { source, target, forward } = lifeTables();
  const result = checkSimulation(source, target, forward);
  assert.equal(result.pass, true);
  assert.equal(result.statesChecked, 8);
  assert.equal(result.stepsChecked, 24);
  assert.equal(target.states.length, 14);
});

test('readable snapshots do not make a new fatal operation backward compatible', () => {
  const { source, target, backward } = lifeTables();
  const result = checkSimulation(target, source, backward);
  assert.equal(result.pass, false);
  assert.equal(result.kind, 'result');
});

test('same observations but changed rebirth response fails operation refinement', () => {
  const { source, target, forward } = lifeTables();
  target.steps.find(row => row.action === 'rebirth' && row.from === 'n1:3:natural').result = 'no-lineage-created';
  assert.equal(checkSimulation(source, target, forward).kind, 'result');
});

test('finite certificates cannot omit a state, transition, action or escaping target', () => {
  const { source, target, forward } = lifeTables();
  const broken = copy(source); broken.steps.pop();
  assert.throws(() => indexMachine(broken), /Non-total/);
  broken.steps.push({ from: 'o1:0', action: 'tick', to: 'outside', result: 'advanced' });
  assert.throws(() => indexMachine(broken), /escapes/);
  source.states.push(copy(source.states[0]));
  assert.throws(() => checkSimulation(source, target, forward), /Duplicate/);
});

test('lossy learned-set to count conversion does not commute with replica merge', () => {
  const { lossyMerge, preservingMerge } = semanticEvidence();
  assert.equal(lossyMerge.pass, false);
  assert.deepEqual(lossyMerge.witness, { left: ['a'], right: ['b'], translated: 2, joined: 1 });
  assert.equal(preservingMerge.pass, true);
  assert.equal(preservingMerge.pairs, 16);
});

test('a schema-valid direct path and a lossy intermediate path need not agree', () => {
  const paths = semanticEvidence().pathDependence;
  assert.equal(paths.directCents, 155); assert.equal(paths.throughWholeUnitsCents, 100);
  // Both are perfectly valid integer payloads. Typechecking did not preserve value.
  assert.ok(Number.isInteger(paths.directCents) && Number.isInteger(paths.throughWholeUnitsCents));
});

test('roundtrip retention and invariant-preserving old-client edits are distinct', () => {
  const state = { name: 'A', hp: 0, dead: true };
  assert.equal(Object.hasOwn(replaceKnownFields(state), 'dead'), false);
  assert.deepEqual(patchName(state, 'A'), state);
  assert.equal(validNewActor(patchName(state, 'B')), true);
  assert.equal(validNewActor({ ...state, hp: 1 }), false);
  assert.equal(state.name, 'A');
});

test('a non-injective compaction can answer old queries but not an added discriminator', () => {
  const result = semanticEvidence();
  assert.equal(result.retentionNow.pass, true);
  assert.equal(result.retentionAfterNewRule.pass, false);
  assert.equal(result.retentionAfterNewRule.witness.query, 'battleReward');
  assert.equal(checkRetention([{ cause: 'battle' }, { cause: 'natural' }], x => x,
    { reward: x => x.cause === 'battle' }).pass, true);
});

test('original record is judged by original rules, not silently reinterpreted', () => {
  const old = { rule: 'award-v1', score: 5 }, rules = { 'award-v1': { threshold: 4 }, 'award-v2': { threshold: 6 } };
  const original = digest(old);
  assert.equal(historicalVerdict(old, rules, mutation).awarded, true, 'INVARIANT: historical decision silently rewritten');
  assert.equal(historicalVerdict({ rule: 'award-v2', score: 5 }, rules).awarded, false);
  assert.equal(digest(old), original);
});

test('a missing historical interpreter yields UNKNOWN, not a new-rule replacement', () => {
  assert.equal(historicalVerdict({ rule: 'award-v1', score: 5 }, { 'award-v2': { threshold: 6 } }, mutation).status,
    'unknown', 'INVARIANT: missing interpretation falsely verified');
});

test('parsing fingerprint equality need not mean logical unit equality', () => {
  // The Avro STRIP rule keeps parsing-relevant attributes, not logicalType. This
  // demonstrates that one specific distinction is lost, not an Avro implementation.
  const millis = { type: 'long', logicalType: 'timestamp-millis' };
  const micros = { type: 'long', logicalType: 'timestamp-micros' };
  const parsingOnly = schema => ({ type: schema.type });
  assert.equal(digest(parsingOnly(millis)), digest(parsingOnly(micros)));
  assert.notEqual(digest(millis), digest(micros));
  assert.notEqual(1000 / 1000, 1000 / 1000000);
});

test('64-bit values must not be silently funneled through a lossy JSON number', () => {
  const a = 9007199254740992n, b = 9007199254740993n;
  assert.notEqual(a, b); assert.equal(Number(a), Number(b));
  assert.throws(() => canonical(Number(a)), /safe-integer/);
  assert.throws(() => canonical(NaN), /safe-integer/);
});

test('request arrival is not a durable write or a published migration', () => {
  let m = ev(initialModel(), { type: 'request', kind: 'command', raw: rawCommand('x') });
  assert.equal(m.local.disk.revision, 0);
  m = ev(m, { type: 'flush', token: m.local.volatile.writes[0].token });
  assert.equal(m.local.disk.v1.a, 2);
});

test('cutover waits for every materialized row rather than trusting a version label', () => {
  let m = tx(tx(tx(initialModel(), 'begin'), 'copy', { key: 'a' }), 'seal');
  m = tx(m, 'activate');
  assert.equal(m.local.disk.active, 1, 'INVARIANT: partial snapshot activated');
  m = tx(m, 'copy', { key: 'b' }); m = tx(m, 'activate');
  assert.equal(m.local.disk.active, 2);
});

test('copy completion is not tail completion: accepted old writes must be replayed', () => {
  let m = copyRows(initialModel());
  m = tx(m, 'command', { raw: rawCommand('x') });
  m = tx(tx(m, 'seal'), 'activate');
  assert.equal(m.local.disk.active, 1, 'INVARIANT: catchup skipped');
  m = finish(m); assert.equal(m.local.disk.v2.a, 2000);
});

test('a delayed duplicate base-copy must not overwrite a replayed row', () => {
  let m = tx(initialModel(), 'begin');
  m = ev(m, { type: 'request', kind: 'copy', key: 'a' });
  const first = m.local.volatile.writes.at(-1).token;
  m = ev(m, { type: 'request', kind: 'copy', key: 'a' });
  const late = m.local.volatile.writes.at(-1).token;
  m = ev(m, { type: 'flush', token: first }); m = tx(m, 'copy', { key: 'b' });
  m = tx(m, 'command', { raw: rawCommand('x') }); m = tx(m, 'replay');
  m = ev(m, { type: 'flush', token: late });
  m = finish(m); assert.equal(m.local.disk.v2.a, 2000);
});

test('a duplicate delta callback is not another semantic update', () => {
  let m = copyRows(initialModel()); m = tx(m, 'command', { raw: rawCommand('x') });
  m = ev(m, { type: 'request', kind: 'replay' }); const first = m.local.volatile.writes.at(-1).token;
  m = ev(m, { type: 'request', kind: 'replay' }); const again = m.local.volatile.writes.at(-1).token;
  m = ev(m, { type: 'flush', token: first }); m = ev(m, { type: 'flush', token: again });
  m = finish(m); assert.equal(m.local.disk.v2.a, 2000);
});

test('operation identity survives schema change, including uncertain old-client retry', () => {
  let m = tx(initialModel(), 'command', { raw: rawCommand('x') });
  const receipt = copy(m.local.disk.operations.x.receipt);
  m = finish(copyRows(m)); m = tx(m, 'command', { raw: rawCommand('x', 'a', 2) });
  m = tx(m, 'command', { raw: rawCommand('x', 'a', 1) });
  assert.deepEqual(m.local.disk.operations.x.receipt, receipt, 'INVARIANT: receipt identity changed');
  assert.equal(m.local.disk.revision, 1);
});

test('new-unit writes are decoded once, not reapplied as old units', () => {
  let m = finish(copyRows(initialModel()));
  m = tx(m, 'command', { raw: rawCommand('y', 'b', 2) });
  assert.equal(m.local.disk.v2.b, 3000);
});

test('a queued old writer after the cut cannot update a retired representation', () => {
  let m = copyRows(initialModel());
  m = ev(m, { type: 'request', kind: 'command', raw: rawCommand('x') });
  const token = m.local.volatile.writes.at(-1).token;
  m = finish(m); m = ev(m, { type: 'flush', token });
  assert.equal(m.local.disk.revision, 0, 'INVARIANT: old writer crossed the cut');
});

test('restart keeps completed rows and receipts but drops unfinished local writes', () => {
  let m = tx(tx(initialModel(), 'begin'), 'copy', { key: 'a' });
  m = ev(m, { type: 'request', kind: 'copy', key: 'b' }); const stale = m.local.volatile.writes.at(-1).token;
  m = ev(ev(m, { type: 'crash' }), { type: 'restart' });
  assert.deepEqual(m.local.disk.migration.shadow, { a: 1000 });
  m = ev(m, { type: 'request', kind: 'copy', key: 'b' });
  m = ev(m, { type: 'flush', token: stale }); assert.equal(m.local.disk.migration.shadow.b, undefined);
  m = ev(m, { type: 'flush', token: m.local.volatile.writes[0].token });
  finish(m);
});

test('one combined history survives interleaved copying, writes, restart and cross-version retry', () => {
  let m = tx(initialModel(), 'begin');
  m = tx(m, 'command', { raw: rawCommand('x') }); m = tx(m, 'copy', { key: 'b' });
  m = ev(ev(m, { type: 'crash' }), { type: 'restart' });
  m = tx(m, 'copy', { key: 'a' }); m = tx(m, 'command', { raw: rawCommand('y', 'b') });
  m = finish(m); m = tx(m, 'command', { raw: rawCommand('x', 'a', 2) });
  m = tx(m, 'command', { raw: rawCommand('z', 'a', 2) });
  assert.deepEqual(m.local.disk.v2, { a: 3000, b: 3000 });
});

test('malformed commands and conflicting id payloads do not become migration data', () => {
  let m = tx(initialModel(), 'command', { raw: rawCommand('x') });
  m = tx(m, 'command', { raw: rawCommand('x', 'b') });
  const revision = m.local.disk.revision;
  for (const raw of [{ ...rawCommand('y'), id: undefined }, { ...rawCommand('y'), amount: NaN },
    { ...rawCommand('y'), extra: true }, { ...rawCommand('y'), key: '__proto__' }, { ...rawCommand('y', 'a', 2), amount: 999 }]) {
    m = tx(m, 'command', { raw });
  }
  assert.equal(m.local.disk.revision, revision);
});

test('replica API is pure local state plus one event; inputs are not mutated', () => {
  const local = initialOwner(), event = { type: 'request', kind: 'begin' }, before = copy(local);
  assert.deepEqual(transition(local, event), transition(copy(local), copy(event)));
  assert.deepEqual(local, before);
});

test('forward compatibility proves nothing about target-only states outside its image', () => {
  const { source, target, forward } = lifeTables();
  target.steps.find(row => row.from === 'n1:0:battle' && row.action === 'rebirth').result = 'changed-new-only-rule';
  assert.equal(checkSimulation(source, target, forward).pass, true);
  assert.equal(Object.values(forward.states).includes('n1:0:battle'), false);
});

test('a valid source integer need not fit the target unit domain; migration blocks', () => {
  let m = initialModel();
  m.local.disk.v1.a = Number.MAX_SAFE_INTEGER;
  m.oracle.coins.a = Number.MAX_SAFE_INTEGER;
  m = tx(m, 'begin'); m = tx(m, 'copy', { key: 'a' }); m = tx(m, 'copy', { key: 'b' });
  m = tx(tx(m, 'seal'), 'activate');
  assert.equal(m.local.disk.migration.blocked, 'target-number-range', 'INVARIANT: migration overflow was not blocked');
  assert.equal(m.local.disk.active, 1);
});

test('a copy that fits can be followed by a delta that leaves the target range', () => {
  let m = initialModel();
  m.local.disk.v1.a = Math.floor(Number.MAX_SAFE_INTEGER / 1000);
  m.oracle.coins.a = Math.floor(Number.MAX_SAFE_INTEGER / 1000);
  m = copyRows(m); m = tx(m, 'command', { raw: rawCommand('x') });
  m = tx(tx(m, 'seal'), 'replay'); m = tx(m, 'activate');
  assert.equal(m.local.disk.migration.blocked, 'target-number-range', 'INVARIANT: migration overflow was not blocked');
  assert.equal(m.local.disk.active, 1);
});

test('malformed historical rules are not verified denials', () => {
  assert.equal(historicalVerdict({ rule: 'award-v1', score: 5 }, { 'award-v1': {} }).status, 'unknown');
});

test('ordinary identifiers that shadow Object prototype names remain valid', () => {
  let m = tx(initialModel(), 'command', { raw: rawCommand('constructor') });
  m = finish(copyRows(m)); m = tx(m, 'command', { raw: rawCommand('constructor', 'a', 2) });
  assert.equal(m.local.disk.revision, 1);
});


test("invalid helper requests do not accidentally flush somebody else's pending write", () => {
  let m = ev(initialModel(), { type: 'request', kind: 'command', raw: rawCommand('x') });
  const queued = copy(m.local.volatile.writes);
  m = tx(m, 'command', { raw: { ...rawCommand('bad'), amount: 0 } });
  assert.deepEqual(m.local.volatile.writes, queued);
  assert.equal(m.local.disk.revision, 0);
});
