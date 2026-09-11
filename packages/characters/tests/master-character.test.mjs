import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_CONTENT, YEAR_MS, LIFESPAN_MS, SHINO_MASTER, GENES, createCharacter, validateCharacter,
  characterData, serializeCharacter, deserializeCharacter, advanceCharacter, appearanceForCharacter,
  ageAppearance, setOutfit, importLifecycleCharacter, auditShinoDocument } from '../src/master-character.js';
import { CharacterReplica, makeCharacterSnapshot, crowdPlan, PoseSchedule } from '../src/character-sync.js';
const make = (id = 'hero', seed = 7, ageMs = 0) => createCharacter({ id, seed, ageMs });
const host = { peerId: 'mayor', epoch: 0 };
const packet = (characters = [make()], extra = {}) => ({ ...makeCharacterSnapshot({ sessionId: 'village-1', host,
  sequence: 0, worldMs: 0, worldState: 'running', characters }), ...extra });
const replica = () => new CharacterReplica({ sessionId: 'village-1', host });

test('deterministic genes, save roundtrip and independent mutation', () => {
  const a = make(), b = make(); assert.deepEqual(a, b); b.genome.height[0] = 42; assert.notDeepEqual(a, b);
  assert.deepEqual(deserializeCharacter(serializeCharacter(a)), a); assert.notDeepEqual(make('hero', 8).genome, a.genome);
  a.privateToken = 'never serialize'; assert.ok(!serializeCharacter(a).includes('never serialize'));
});
test('diploid inherited genome and bounded differences', () => {
  const parents = [make('p1', 1), make('p2', 2)], child = createCharacter({ id: 'child', seed: 3, parents });
  assert.deepEqual(child.parents, ['p1', 'p2']);
  for (let i = 0; i < 2; i++) for (const gene of GENES) assert.ok(parents[i].genome[gene].some(a => Math.abs(a - child.genome[gene][i]) <= 256));
  for (let seed = 0; seed < 1000; seed++) validateCharacter(createCharacter({ id: 'child', seed, parents }));
  assert.throws(() => createCharacter({ id: 'p1', seed: 0, parents }));
  assert.throws(() => createCharacter({ id: 'child', seed: 0, parents: [parents[0], parents[0]] }));
});
test('age clock uses world delta once; freeze, exact birthdays, death once', () => {
  let c = make(); assert.equal(advanceCharacter(c, YEAR_MS - 1).birthdays, 0);
  c = advanceCharacter(c, YEAR_MS).character; assert.equal(c.ageMs, YEAR_MS);
  assert.deepEqual(advanceCharacter(c, YEAR_MS, false).character, c);
  const death = advanceCharacter(c, LIFESPAN_MS); assert.equal(death.died, true); assert.equal(death.character.ageMs, LIFESPAN_MS);
  assert.equal(advanceCharacter(death.character, 1).died, false);
  assert.throws(() => advanceCharacter(c, NaN)); assert.throws(() => advanceCharacter(c, -1));
});
test('clock partitions converge; 20x externally scaled world delta is not scaled again', () => {
  let c = make(); for (let i = 0; i < 60; i++) c = advanceCharacter(c, 1000).character;
  assert.equal(c.ageMs, advanceCharacter(make(), 60_000).character.ageMs);
  assert.equal(advanceCharacter(make(), 3000 * 20).character.ageMs, YEAR_MS);
});
test('lifecycle importer preserves source save and curve boundaries', () => {
  const old = { version: 1, ageSeconds: 540, rate: 20, enemiesEnabled: false }, copy = structuredClone(old);
  assert.equal(importLifecycleCharacter(old, { id: 'hero', seed: 0 }).ageMs, 540_000); assert.deepEqual(old, copy);
  assert.equal(ageAppearance(0).scale, .4); assert.equal(ageAppearance(22).scale, 1);
  assert.equal(ageAppearance(6.999).canEquipWeapon, false); assert.equal(ageAppearance(7).canEquipWeapon, true);
  assert.equal(ageAppearance(90).gray, 1); assert.throws(() => ageAppearance(Infinity));
  for (const age of [0, 3, 7, 12, 18, 22, 50, 65, 80, 90]) assert.ok(Number.isFinite(ageAppearance(age).scale));
});
test('extreme genes remain within approved visual range; outfit swaps preserve ancestry', () => {
  for (const allele of [0, 65535]) { const c = make(); GENES.forEach(g => { c.genome[g] = [allele, allele]; });
    const a = appearanceForCharacter(c); assert.ok(a.height >= .9 && a.height <= 1.1); assert.ok(a.width >= .88 && a.width <= 1.12); }
  const c = make(), next = setOutfit(c, 'shino.uniform.moss.v1'); assert.deepEqual(next.genome, c.genome); assert.equal(c.revision, 0);
  assert.throws(() => setOutfit(c, 'unregistered.garment')); assert.throws(() => setOutfit(c, '__proto__'));
  assert.ok(Object.isFrozen(SHINO_MASTER.license.authors));
});
for (const mutate of [c => c.ageMs = NaN, c => c.seed = -1, c => c.schemaVersion = 99,
  c => c.contentVersion = 'future', c => c.id = '../../file', c => c.genome.hair = [1],
  c => c.parents = [c.id, 'other'], c => c.revision = 1.5, c => c.lifeState = 'invincible']) {
  test(`reject invalid character: ${String(mutate)}`, () => { const c = make(); mutate(c); assert.throws(() => validateCharacter(c)); });
}
test('oversized and invalid JSON rejected', () => { assert.throws(() => deserializeCharacter(' '.repeat(4097))); assert.throws(() => deserializeCharacter('{')); });
test('30 replicas are independent and packet ordering is canonical', () => {
  const rows = Array.from({ length: 30 }, (_, i) => make(`actor-${i}`, i)); const a = replica(), b = replica();
  const one = a.receive(packet(rows), 'mayor'), two = b.receive(packet(rows), 'mayor'); assert.deepEqual(one, two);
  one.characters[0].genome.hair[0] = 42; assert.notDeepEqual(one, a.snapshot()); assert.deepEqual(a.snapshot(), b.snapshot());
  assert.throws(() => makeCharacterSnapshot({ sessionId: 'village-1', host, sequence: 0, worldMs: 0, characters: [...rows, make('extra')] }));
});
test('authorized delta, missing baseline, replay and clock rollback', () => {
  const r = replica(); r.receive(packet(), 'mayor');
  const c = advanceCharacter(make(), YEAR_MS).character;
  const delta = packet([], { kind: 'delta', upsert: [c], remove: [], baseSequence: 0, sequence: 1, worldMs: YEAR_MS });
  assert.equal(r.receive(delta, 'mayor').characters[0].ageMs, YEAR_MS);
  assert.throws(() => r.receive(delta, 'mayor'));
  assert.throws(() => r.receive({ ...delta, sequence: 2, baseSequence: 0 }, 'mayor'));
  assert.throws(() => r.receive(packet([c], { sequence: 2, worldMs: 0 }), 'mayor'));
});
test('bad row is atomic, sequence not poisoned; stale hosts cannot self-elect', () => {
  const r = replica(); r.receive(packet(), 'mayor'); const before = r.snapshot(), bad = make('bad'); bad.genome.eyes[0] = 70000;
  assert.throws(() => r.receive({ ...packet(), characters: [make(), bad], sequence: 1 }, 'mayor')); assert.deepEqual(r.snapshot(), before);
  for (const p of [packet([], { sessionId: 'other', sequence: 1 }), packet([], { host: { peerId: 'attacker', epoch: 100 }, sequence: 1 }), packet([], { contentVersion: 'future', sequence: 1 })]) assert.throws(() => r.receive(p, 'attacker'));
  assert.equal(r.receive(packet([make()], { sequence: 1 }), 'mayor').sequence, 1);
});
test('host migration preserves clock/lineage floor and rejects previous host', () => {
  const r = replica(), aged = advanceCharacter(make(), YEAR_MS).character;
  r.receive(packet([aged], { sequence: 4, worldMs: YEAR_MS }), 'mayor');
  r.migrateAuthority({ peerId: 'deputy', epoch: 1 }); assert.equal(r.snapshot().worldState, 'paused');
  assert.throws(() => r.receive(packet([aged], { sequence: 5, worldMs: YEAR_MS }), 'mayor'));
  assert.throws(() => r.receive(packet([make()], { host: { peerId: 'deputy', epoch: 1 }, worldMs: YEAR_MS }), 'deputy'));
  assert.equal(r.receive(packet([aged], { host: { peerId: 'deputy', epoch: 1 }, worldMs: YEAR_MS }), 'deputy').characters[0].ageMs, YEAR_MS);
  assert.throws(() => r.migrateAuthority({ peerId: 'mayor', epoch: 0 }));
});
test('immutable genes, unversioned edits and age speed hacks rejected', () => {
  const r = replica(); r.receive(packet(), 'mayor');
  for (const transform of [c => { c.genome.hair[0]++; c.revision++; }, c => { c.outfitId = 'shino.uniform.moss.v1'; }, c => { c.ageMs++; c.revision++; }]) {
    const c = make(); transform(c); assert.throws(() => r.receive(packet([c], { sequence: 1 }), 'mayor'));
  }
});
test('LOD schedules never control simulation and prioritize visible nearby actors', () => {
  const actors = Array.from({ length: 30 }, (_, i) => ({ id: `a${i}`, distance: i, visible: i !== 0, important: i === 1 }));
  const plan = crowdPlan(actors); assert.equal(plan.filter(p => p.tier === 'full').length, 6);
  assert.equal(plan.find(p => p.id === 'a0').animationHz, 0); assert.equal(plan.find(p => p.id === 'a1').animationHz, 60);
  assert.equal(plan.find(p => p.id === 'a29').animationHz, 5); assert.ok(plan.every(p => !p.castShadow));
  assert.throws(() => crowdPlan([...actors, actors[0]])); assert.throws(() => crowdPlan([{ ...actors[0], distance: NaN }]));
  const s = new PoseSchedule(); assert.equal(s.advance(0, 5), 0); assert.equal(s.advance(.1, 5), null); assert.equal(s.advance(.1, 5), .2);
  assert.equal(s.advance(.1, 0), null); assert.equal(s.advance(0, 5), 0);
});
test('source hash and license are both required, external resource injection rejected', () => {
  const doc = { asset: { version: '2.0' }, extensions: { VRMC_vrm: { specVersion: '1.0', meta: {} } } };
  assert.equal(auditShinoDocument(doc, '0'.repeat(64)).approved, false);
  assert.ok(auditShinoDocument(doc, SHINO_MASTER.source.sha256).errors.includes('incompatible-license'));
});
