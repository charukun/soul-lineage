import test from 'node:test';
import assert from 'node:assert/strict';
import { RealityExperiment, runComparison } from '../src/game/reality-lab/engine.js';
import { DEFAULTS, STEP_MS, normalizeConfig, checksum } from '../src/game/reality-lab/config.js';
import { ModelWire } from '../src/game/reality-lab/wire.js';
import { makeWorld, stepWorld, worldRoot, verifyCollapse } from '../src/game/reality-lab/world.js';
import { createReport, readReport, discussionText } from '../src/game/reality-lab/report.js';

const clean = { ...DEFAULTS, durationMs: 16000, scenario: 'steady', loss: 0, latencyMs: 0, jitterMs: 0 };

test('a recorded seed reproduces payload accounting, queue outcomes and recovery exactly', () => {
  const config = { ...DEFAULTS, peers: 9, durationMs: 16000, loss: 0.05 };
  assert.deepEqual(new RealityExperiment(config).finish().result(), new RealityExperiment(config).finish().result());
});

test('30 peers: distribution lowers busiest endpoint load, without changing the scripted world', () => {
  const rows = runComparison(clean), [global, interest, cells] = rows;
  assert.equal(new Set(rows.map(r => r.root)).size, 1);
  assert.ok(global.payloadBytes > interest.payloadBytes);
  assert.ok(cells.maxPeerKbps < interest.maxPeerKbps / 2);
  assert.ok(cells.byKind['cell-report'] > 0);
  for (const row of rows) {
    assert.equal(row.messages, row.delivered + row.dropped + row.inFlight);
    assert.equal(row.payloadBytes, Object.values(row.byPeer).reduce((sum, p) => sum + p.tx, 0));
    assert.equal(row.omenRecipients.length, 30);
    assert.equal(row.freezeViolations, 0);
  }
});

test('all players in one cell: distributed authority does not claim a large fan-out win', () => {
  const [, interest, cells] = runComparison({ ...clean, layout: 'dense' });
  assert.ok(cells.maxPeerKbps > interest.maxPeerKbps * 0.9);
  assert.equal(cells.root, interest.root);
  assert.ok(cells.actorUpdates < interest.actorUpdates);
});

test('host hard loss freezes world time, restores delivered checkpoint, increments epoch and reconnects', () => {
  const m = new RealityExperiment({ ...DEFAULTS, loss: 0 });
  while (m.now < 8000) m.step();
  const stopped = m.world.tick;
  while (m.now < 12000) { m.step(); assert.equal(m.world.tick, stopped); }
  m.finish(); const r = m.result();
  assert.equal(r.phase, 'open'); assert.equal(r.epoch, 2); assert.equal(r.freezeViolations, 0);
  assert.equal(r.migrations.length, 1); assert.ok(r.migrations[0] >= 4000);
  assert.ok(r.rollbackMs > 0); assert.ok(r.darkMs >= 4000);
  assert.ok(m.replication.views.get('p00')?.entities.size > 0);
  assert.equal(m.authority.hostId, 'p01');
});

test('loss of all backup data cannot silently restore the coordinator copy', () => {
  const m = new RealityExperiment({ ...DEFAULTS, loss: 0, durationMs: 24000 });
  while (m.now < 8100) m.step();
  m.checkpoints.clear(); m.wire.pending = [];
  m.finish(); const r = m.result();
  assert.equal(r.phase, 'closed'); assert.equal(r.migrations.length, 0);
  assert.equal(r.worldMs, 7950);
});

test('corrupt payload is rejected and requests repair over the same lossy wire', () => {
  const rows = runComparison({ ...clean, scenario: 'divergence' });
  for (const r of rows) { assert.equal(r.invalid, 1); assert.ok(r.repairs >= 1); assert.ok(r.byKind['repair-request'] > 0); }
});

test('old epoch and old cell authority cannot overwrite a current replica', () => {
  const m = new RealityExperiment(clean).finish();
  const entities = [{ id: 'p00', cell: 0, x: 999, z: 0 }];
  const before = structuredClone(m.replication.views.get('p03'));
  m.replication.receive({ from: 'p00', to: 'p03', payload: { kind: 'snapshot', epoch: 0, term: 1, cell: 0, sequence: 99999, entities, hash: checksum(entities) } });
  m.replication.receive({ from: 'p01', to: 'p03', payload: { kind: 'snapshot', epoch: 1, term: 1, cell: 0, sequence: 99999, entities, hash: checksum(entities) } });
  assert.deepEqual(m.replication.views.get('p03'), before);
});

test('cell owner departure changes its term and replication continues under another endpoint', () => {
  const m = new RealityExperiment({ ...clean, scenario: 'cell' }).finish();
  assert.equal(m.cellHosts[1], 'p04'); assert.equal(m.cellTerms[1], 2);
  assert.equal(m.authority.epoch, 1); assert.equal(m.result().phase, 'open');
  assert.ok(m.replication.views.get('p07')?.entities.size > 0);
});

test('cold NPCs recover from elapsed world ticks, matching full per-tick simulation across revisits', () => {
  const config = { ...clean, layout: 'dense', scenario: 'collapse' };
  const full = makeWorld(config), lazy = makeWorld(config), alive = new Set(full.players.map(p => p.id));
  for (let i = 0; i < 320; i += 1) { stepWorld(full, 'interest', alive, 'collapse'); stepWorld(lazy, 'cells', alive, 'collapse'); }
  assert.equal(worldRoot(full), worldRoot(lazy)); assert.ok(lazy.collapses >= 2);
  assert.ok(lazy.updates < full.updates); assert.equal(verifyCollapse(lazy), true);
});

test('wire charges serialized payloads, rejects dead endpoints on delivery, and has bounded delay', () => {
  const wire = new ModelWire({ ...clean, latencyMs: 100 }), packet = { kind: 'hello', text: '日本語' };
  wire.send('p00', 'p01', packet, 0);
  assert.equal(wire.bytes, new TextEncoder().encode(JSON.stringify(packet)).length);
  wire.drain(STEP_MS, new Set(['p00', 'p01']), () => assert.fail('early packet'));
  wire.drain(100, new Set(['p00']), () => assert.fail('dead recipient'));
  assert.equal(wire.dropped, 1);
});

test('reports preserve model limits, captured conditions and reproducible results', () => {
  const results = runComparison({ ...clean, peers: 3 });
  const report = createReport({ config: { ...clean, peers: 3 }, results, hypothesis: 'x', build: { commit: 'a'.repeat(40) } });
  assert.deepEqual(readReport(JSON.stringify(report)).config, report.config);
  const text = discussionText(report);
  assert.match(text, /実WebRTC\/NAT\/TURN/); assert.match(text, /最新develop/);
  assert.throws(() => readReport('{"format":"rrp-lab/2"}'));
  assert.throws(() => normalizeConfig({ peers: 31 }));
  assert.throws(() => normalizeConfig({ durationMs: 16001 }));
});
