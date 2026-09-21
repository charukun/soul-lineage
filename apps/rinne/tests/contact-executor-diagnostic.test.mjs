import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { createLife, setMoving, tickLife } from '../src/rebuild/domain.js';

// Temporary hosted-runner diagnostic. Original regression tests remain unchanged.
// Instrument an isolated copy to observe private executor lifetime, then remove it.
test('contact executor lifetime diagnostic', async () => {
  const coreURL = new URL('../src/rebuild/combat-core.js', import.meta.url);
  const evolvedURL = new URL('../src/rebuild/combat-evolution-runtime.js', import.meta.url);
  const directory = await mkdtemp(fileURLToPath(new URL('../src/rebuild/.contact-probe-', import.meta.url)));
  const coreCopy = pathToFileURL(join(directory, 'core.mjs'));
  const evolvedCopy = pathToFileURL(join(directory, 'evolved.mjs'));
  const resolveImports = (source, base) => source.replace(/from (['"])(\.[^'"]+)\1/g, (_, quote, path) => `from '${new URL(path, base).href}'`);
  try {
    const originalCore = await readFile(coreURL, 'utf8');
    assert.ok(originalCore.includes('const SESSIONS=new WeakMap()'));
    await writeFile(coreCopy, resolveImports(originalCore, coreURL) + '\nexport const probeSessions = state => [...(SESSIONS.get(state)?.values() || [])];\n');
    const originalEvolved = await readFile(evolvedURL, 'utf8');
    await writeFile(evolvedCopy, resolveImports(originalEvolved.replace("from './combat-core.js'", `from '${coreCopy.href}'`), evolvedURL));
    const core = await import(coreCopy.href);
    const evolved = await import(evolvedCopy.href);
    const state = createLife({ seed: 6 });
    Object.assign(state, { phase: 'living', ageSeconds: 1200, ageYears: 20, zone: 'frontier', position: { x: 0, z: 0 } });
    state.equipment.weapon = 'sword'; state.knownSkills.push('basic.sword'); state.skillWeights.jo = { 'basic.sword': 100 };
    const front = core.createFront(0, 6); front.enemies[0].x = .5; front.enemies[0].z = .5;
    const prior = new Map(), changes = [], counts = {}, events = [];
    for (let frame = 0; frame < 120; frame++) {
      setMoving(state, false); tickLife(state, { realDelta: 1 / 60 });
      events.push(...evolved.tickEvolvedFront(state, front, 1 / 60));
      for (const session of core.probeSessions(state)) {
        const previous = prior.get(session.targetId);
        if (previous?.ref !== session) {
          const before = previous ? JSON.parse(previous.signature) : {}, after = JSON.parse(session.signature);
          const keys = Object.keys(after).filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
          changes.push({ frame, target: session.targetId, previousTime: previous?.time, time: session.last.time, invalid: previous?.invalid, keys, values: Object.fromEntries(keys.map(key => [key, { before: before[key], after: after[key] }])) });
          counts[session.targetId] = (counts[session.targetId] || 0) + 1;
        }
        prior.set(session.targetId, { ref: session, time: session.last.time, signature: session.signature, invalid: session.invalid });
      }
    }
    const trimmed = changes.filter(row => row.frame > 0);
    console.log('CONTACT_EXECUTOR_DIAGNOSTIC ' + JSON.stringify({ counts, changes: [...trimmed.slice(0, 8), ...trimmed.slice(-3)], final: core.probeSessions(state).map(row => ({ target: row.targetId, time: row.last.time, hero: { attack: row.last.hero.attack, combatReady: row.last.hero.combatReady, yaw: row.last.hero.yaw }, stats: row.last.stats })), events }));
    assert.ok(events.some(event => event.type === 'player-hit'), 'contact must produce a real automatic hit within the existing two-second deadline');
  } finally { await rm(directory, { recursive: true, force: true }); }
});
