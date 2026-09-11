import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { GENES, appearanceForCharacter, auditShinoDocument } from '@soul/characters';
import { reviewSettings, createReviewCohort, editReviewCharacter, canonicalCohort, serializeReviewSession, deserializeReviewSession, reviewGlbDocument } from '../src/character-review-state.js';
const buffer = b => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
function glb(doc, bin) {
  const json = Buffer.from(JSON.stringify(doc)), jsonSize = Math.ceil(json.length / 4) * 4;
  const result = Buffer.alloc(20 + jsonSize + (bin ? 8 + bin.length : 0));
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(jsonSize, 12); result.writeUInt32LE(0x4e4f534a, 16); result.fill(32, 20, 20 + jsonSize); json.copy(result, 20);
  if (bin) { result.writeUInt32LE(bin.length, 20 + jsonSize); result.writeUInt32LE(0x004e4942, 24 + jsonSize); bin.copy(result, 28 + jsonSize); }
  return buffer(result);
}
test('cohort generation is deterministic, bounded and uses canonical appearance', () => {
  const a = createReviewCohort({ seed: 0xffffffff }), b = createReviewCohort({ seed: 0xffffffff });
  assert.deepEqual(a, b); assert.equal(a.length, 30); assert.equal(a[1].seed, 0); assert.equal(new Set(a.map(c => c.id)).size, 30);
  assert.notDeepEqual(a[2].genome, a[3].genome); a.forEach(c => assert.ok(appearanceForCharacter(c).height >= .9));
  assert.notDeepEqual(createReviewCohort({ seed: 42 }), a);
});
test('family mode uses the two actual parent records and independent allele arrays', () => {
  const rows = createReviewCohort({ seed: 123, ancestry: 'family' });
  assert.deepEqual(rows[2].parents, [rows[0].id, rows[1].id]); assert.deepEqual(rows[0].parents, []);
  for (const row of rows.slice(2)) for (const gene of GENES) {
    assert.notEqual(row.genome[gene], rows[0].genome[gene]);
    for (let i = 0; i < 2; i++) assert.ok(rows[i].genome[gene].some(allele => Math.abs(allele - row.genome[gene][i]) <= 256));
  }
});
test('inspection edits are copies, retain unrelated genes and enforce production bounds', () => {
  const record = createReviewCohort()[0], original = JSON.stringify(record);
  const edited = editReviewCharacter(record, { age: 90, height: 1, build: 0, outfit: 'moss' });
  assert.equal(JSON.stringify(record), original); assert.equal(edited.revision, 1); assert.equal(edited.lifeState, 'dead');
  assert.deepEqual(edited.genome.height, [65535, 65535]); assert.deepEqual(edited.genome.build, [0, 0]);
  assert.deepEqual(edited.genome.hair, record.genome.hair); assert.equal(editReviewCharacter(edited, { age: 7 }).lifeState, 'alive');
  for (const changes of [{ height: NaN }, { build: 2 }, { age: -1 }, { outfit: 'naked' }]) assert.throws(() => editReviewCharacter(record, changes));
});
test('settings reject malformed controls and clamp selection after count changes', () => {
  for (const patch of [{ count: 31 }, { seed: -1 }, { seed: 1.5 }, { age: 91 }, { springs: 'unlimited' }, { blink: 'true' }, { expressionWeight: Infinity }, { view: 'unknown' }])
    assert.throws(() => reviewSettings(patch));
  assert.equal(reviewSettings({ count: 1, selected: 29 }).selected, 0); assert.equal(reviewSettings({ unexpected: 'private' }).unexpected, undefined);
});
test('bounded JSON round trip preserves edits and notes but does not trust imported metrics', () => {
  const settings = reviewSettings({ count: 30, seed: 2026, expression: 'happy' }), records = createReviewCohort(settings);
  records[3] = editReviewCharacter(records[3], { hair: 1 });
  const text = serializeReviewSession({ settings, records, note: '個体4の髪', metrics: { hardwareAcceptance: 'fake' } });
  const parsed = deserializeReviewSession(text); assert.deepEqual(parsed.records, records); assert.equal(parsed.note, '個体4の髪'); assert.equal(parsed.metrics, undefined);
  assert.throws(() => deserializeReviewSession(' '.repeat(65537))); assert.throws(() => deserializeReviewSession(text.replace('shino-production-contract.1', 'unknown')));
  assert.throws(() => canonicalCohort([records[0], records[0]])); assert.throws(() => serializeReviewSession({ settings, records: records.slice(0, 2) }));
});
test('GLB validation rejects truncation, duplicates, external resources and mismatched BIN', () => {
  assert.equal(reviewGlbDocument(glb({ asset: { version: '2.0' } })).asset.version, '2.0');
  const binary = glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 4 }] }, Buffer.alloc(4)); assert.ok(reviewGlbDocument(binary));
  assert.throws(() => reviewGlbDocument(binary.slice(0, -1)));
  assert.throws(() => reviewGlbDocument(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 10 }] }, Buffer.alloc(4))));
  assert.throws(() => reviewGlbDocument(glb({ asset: { version: '2.0' }, images: [{ uri: 'https://example.invalid/x' }] })));
  const bad = binary.slice(0); new DataView(bad).setUint32(12, 0xffffffff, true); assert.throws(() => reviewGlbDocument(bad));
  assert.throws(() => reviewGlbDocument(new ArrayBuffer(3)));
});
test('repository Shino asset still passes the unchanged content and license audit', () => {
  const bytes = readFileSync(new URL('../public/simulator/assets/SHINO_review.vrm', import.meta.url));
  const doc = reviewGlbDocument(buffer(bytes)), hash = createHash('sha256').update(bytes).digest('hex');
  const audit = auditShinoDocument(doc, hash); assert.equal(audit.approved, true, audit.errors.join(', '));
  assert.ok(doc.extensions.VRMC_vrm.expressions); assert.ok(doc.extensions.VRMC_springBone);
});
