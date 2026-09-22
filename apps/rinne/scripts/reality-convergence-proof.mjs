import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { coordinationEnvelope, eventSizes, lineageGrowthEnvelope, recoveryPareto, semanticCompactionPareto, sizeEnvelope, strongEncodingEnvelope } from './rrp-convergence/model.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'scripts/rrp-convergence/model.mjs',
  'scripts/rrp-convergence/core.mjs',
  'scripts/rrp-convergence/kernel.mjs',
  'scripts/rrp-convergence/cost.mjs',
  'scripts/rrp-convergence/oracle.mjs',
  'scripts/rrp-convergence/shadow-extractor.mjs',
  'scripts/rrp-convergence/workload.mjs',
  'scripts/reality-convergence-proof.mjs',
  'tests/reality-convergence-kernel-core.test.mjs',
  'tests/reality-convergence-cost.test.mjs',
  'tests/reality-convergence-compaction-extractor.test.mjs',
];
const artifactFiles = [
  'docs/THEORY_CONVERGENCE_SEMANTIC_KERNEL.md',
  'docs/THEORY_CONVERGENCE_SOURCES.md',
  'docs/evidence/RRP_CONVERGENCE_EFFECT_MANIFEST_20260918.json',
  'docs/evidence/RRP_CONVERGENCE_EXPERIMENT_PLAN_20260918.json',
];
const testFiles = [
  'tests/reality-convergence-kernel-core.test.mjs',
  'tests/reality-convergence-cost.test.mjs',
  'tests/reality-convergence-compaction-extractor.test.mjs',
];
const mutations = {
  'drop-rebirth-deps': 'a sealed actor carries rebirth dependencies instead of trusting an older snapshot',
  'forget-rebirth-op': 'rebirth operation receipt survives recovery from a pre-rebirth snapshot',
  'ignore-snapshot-root': 'recovery snapshot must be bound to the canon root at its claimed base sequence',
  'trust-snapshot-protected': 'a valid prefix label does not make provisional snapshot contents authoritative',
  'ignore-epoch': 'stale epoch event is rejected unless it is the explicit next authority acquisition',
  'compact-from-provisional': 'protected compaction must derive protected fields from the journal, not a provisional checkpoint',
  'drop-compaction-dedupe': 'protected compaction retains the operation-dedupe ledger across prefix garbage collection',
};
function runTest(mutation = 'none') {
  const child = spawnSync(process.execPath, ['--test', ...testFiles.map(file => resolve(app, file))], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, RRP_CONVERGENCE_MUTATION: mutation },
  });
  const text = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  return { exit: child.status, error: child.error?.message ?? null,
    passed: Number(text.match(/# pass (\d+)/)?.[1] ?? 0), failed: Number(text.match(/# fail (\d+)/)?.[1] ?? 0),
    invariantFailure: text.includes('INVARIANT:'), failures: [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(x => x[1]) };
}
const focused = runTest();
const negativeControls = Object.entries(mutations).map(([mutation, expected]) => {
  const result = runTest(mutation);
  return { mutation, expected, ...result, killed: result.exit !== 0 && result.failed > 0 && result.invariantFailure && result.failures.some(x => x.startsWith(expected)) };
});
const syntax = files.map(file => {
  const child = spawnSync(process.execPath, ['--check', resolve(app, file)], { encoding: 'utf8', timeout: 10000 });
  return { file, pass: child.status === 0, error: child.error?.message ?? (child.stderr.trim() || null) };
});
const sizes = [1, 2, 5, 10, 20, 30].map(players => sizeEnvelope({ players, followerCopies: 1, canonEvents: 4, recoverySnapshots: 60 }));
const encodings = Object.fromEntries(['birth', 'lifeSeal', 'rebirth'].map(eventType => [eventType, Array.from({ length: 30 }, (_, i) => strongEncodingEnvelope({ players: 30, affectedActors: i + 1, eventType }))]));
const encodingSummary = {
  cases: Object.values(encodings).flat().length,
  pass: Object.values(encodings).flat().every(row => row.selectedStrongBytes <= row.eventStrongBytes && row.selectedStrongBytes <= row.checkpointStrongBytes),
  crossovers: Object.fromEntries(Object.entries(encodings).map(([eventType, rows]) => [eventType, rows.find(row => row.selected === 'checkpoint')?.affectedActors ?? null])),
  sha256: createHash('sha256').update(JSON.stringify(encodings)).digest('hex'),
};
const recovery = recoveryPareto({ players: 30, durationSeconds: 60 });
const eventSizeSummary = eventSizes({ players: 30 });
const lineageGrowth = lineageGrowthEnvelope();
const compaction = semanticCompactionPareto({ players: 30, canonEvents: 1000 });
const envelope = [
  { label: 'no-replaceable', ...coordinationEnvelope({ protectedEvents: 10, replaceableUpdates: 0, protectedBytes: 700, replaceableBytes: 120 }) },
  { label: 'mixed-small', ...coordinationEnvelope({ protectedEvents: 10, replaceableUpdates: 100, protectedBytes: 700, replaceableBytes: 120 }) },
  { label: 'mixed-large', ...coordinationEnvelope({ protectedEvents: 10, replaceableUpdates: 10000, protectedBytes: 700, replaceableBytes: 120 }) },
];
const effectManifest = JSON.parse(readFileSync(resolve(app, 'docs/evidence/RRP_CONVERGENCE_EFFECT_MANIFEST_20260918.json'), 'utf8'));
const experimentPlan = JSON.parse(readFileSync(resolve(app, 'docs/evidence/RRP_CONVERGENCE_EXPERIMENT_PLAN_20260918.json'), 'utf8'));
const artifactContract = {
  pass: effectManifest.sourceDevelop === 'd23c28671a221a5fc39f81c56af99ea32e6e5beb' &&
    effectManifest.protectedCurrent.map(row => row.effect).join('|') === 'player.birth|life.seal|life.rebirth|authority.epoch.acquire' &&
    experimentPlan.status === 'planned-not-executed' && experimentPlan.variants.some(row => row.id === 'fair-known-event-sourcing') &&
    experimentPlan.existingSafetyKeys.length === 6 && experimentPlan.existingPrimaryMetrics.includes('canonCommitP95Ms'),
  protectedEffects: effectManifest.protectedCurrent.map(row => row.effect),
  experimentVariants: experimentPlan.variants.map(row => row.id),
  safetyKeys: experimentPlan.existingSafetyKeys,
};
const report = {
  format: 'rrp-convergence-semantic-kernel-v1',
  startDevelop: 'd23c28671a221a5fc39f81c56af99ea32e6e5beb',
  classification: 'B finite executable evidence. Source-derived effect classification and A/C/D/E/F boundaries are in THEORY_CONVERGENCE_SEMANTIC_KERNEL.md.',
  environment: { node: process.version, platform: process.platform, arch: process.arch, workspace: 'isolated repository-like authoring workspace; no full checkout' },
  focused, negativeControls, syntax, artifactContract, sizes, eventSizeSummary, encodingSummary, lineageGrowth, recovery, compaction, envelope,
  sourceHashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(app, file))).digest('hex')])),
  artifactHashes: Object.fromEntries(artifactFiles.map(file => [file, createHash('sha256').update(readFileSync(resolve(app, file))).digest('hex')])),
  limitations: [
    'The synthetic world is source-shaped but is not a serialization of a running CoopWorld instance.',
    'The semantic journal verifies structural lineage/authority invariants, not honest combat/reward derivation.',
    'Size figures are JSON byte measurements of the synthetic schema, not WebRTC framing, compression, radio or device measurements.',
    'The fair semantic/event-sourcing baseline is intentionally allowed the same semantic partition and therefore matches candidate strong-byte cost.',
    'No multi-owner membership/reconfiguration, Byzantine host, storage loss, full game refinement or unbounded state-space proof.',
    'No context:plan/npm/full repository/Node24/browser/WebRTC/device validation because no full checkout is available.',
  ],
};
report.pass = focused.exit === 0 && focused.failed === 0 && focused.passed >= 37 && negativeControls.every(x => x.killed) && syntax.every(x => x.pass) && artifactContract.pass && sizes.every(x => x.strictVsWholeCheckpoint && x.matchesFairKnownBaseline) && encodingSummary.pass && lineageGrowth.deltaBoundedByHistoryLength && lineageGrowth.naiveGrowthVisible && recovery.tradeoffVisible && compaction.tradeoffVisible && envelope.every(x => x.candidateMatchesFairBaseline);
if (process.argv[2]) writeFileSync(resolve(process.argv[2]), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, focused, mutations: negativeControls.map(({ mutation, killed, failed }) => ({ mutation, killed, failed })), sizes, envelope, syntaxPass: syntax.every(x => x.pass) }, null, 2));
if (!report.pass) process.exitCode = 1;
