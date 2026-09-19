import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { git, gameId } from './contract.mjs';

export const SOURCES = Object.freeze({ village: 'apps/village/src/game/demography.js', kuumetsu: 'apps/demon/src/hunt/balance.js' });
const digest = value => createHash('sha256').update(value).digest('hex');
const ensure = (condition, message) => { if (!condition) throw new Error(`AUTONOMOUS_PROBE: ${message}`); };
export function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  ensure(typeof value !== 'number' || Number.isFinite(value), 'non-finite metric');
  return value;
}
export const stable = value => JSON.stringify(canonical(value));
export function villageProbe(api, seeds) {
  const rows = [];
  for (const seed of seeds) {
    const input = { population: 12, limit: 20, openBeds: 18, eligibleAdults: 8, comfort: 6, foodStock: 60 + seed % 7, birthCarry: .8 };
    for (const [condition, patch] of Object.entries({ supported: {}, noFood: { foodStock: 0 }, noBeds: { openBeds: 12 }, noAdults: { eligibleAdults: 0 } })) {
      const result = api.planDemographicYear({ ...input, ...patch });
      rows.push({ id: `${seed}/${condition}`, seed, condition, metrics: { births: result.births, departures: result.departures, headroom: result.headroom, pairs: result.pairs } });
    }
    const age = api.advanceVirtualCohorts({ child: 13, youth: 5, adult: 44, elder: 14 });
    rows.push({ id: `${seed}/cohortYear`, seed, condition: 'cohortYear', metrics: { children: age.cohorts.child, youth: age.cohorts.youth, adults: age.cohorts.adult, elders: age.cohorts.elder, deaths: age.deaths } });
  }
  return rows;
}
export function kuumetsuProbe(api, seeds) {
  const rows = [], species = ['night-creature', 'grave-ogre', 'night-bat'];
  for (const seed of seeds) {
    const meals = 2 + seed % 3, monsterSpecies = species[seed % species.length];
    for (const condition of ['verifiedReturn', 'unverifiedReturn', 'defeat', 'forageReturn']) {
      const profile = { unlocked: [], monsterSpecies }, route = condition === 'forageReturn' ? 'forage' : 'mission';
      const plan = api.huntPlan(profile, route), before = api.bodyStats(profile, 0, monsterSpecies);
      const result = api.settleProgress(profile, condition === 'defeat' ? 'defeated' : 'escaped', meals, {
        carried: meals * api.preyValue('traveller'), plan, targetEaten: false, returnVerified: condition !== 'unverifiedReturn'
      });
      const after = api.bodyStats(profile, 0, monsterSpecies), next = api.huntPlan(profile);
      rows.push({ id: `${seed}/${condition}`, seed, condition, metrics: {
        meals, species: monsterSpecies, extracted: result.extracted, gained: result.gained, lost: result.lost,
        chapter: result.chapter, nextTarget: next.target, hpBefore: before.baseHP, hpAfter: after.baseHP,
        tempoBefore: before.tempo, tempoAfter: after.tempo, moveBonusAfter: after.moveBonus
      } });
    }
    for (const upgrade of ['fang', 'heart', 'stride']) {
      const progress = api.freshProgress(); progress.essence = 24;
      const profile = { [api.PROGRESS_KEY]: progress, unlocked: [] };
      const purchased = api.buyUpgrade(profile, upgrade), stats = api.bodyStats(profile, 0, monsterSpecies);
      rows.push({ id: `${seed}/${upgrade}`, seed, condition: upgrade, metrics: { purchased, essence: api.readProgress(profile).essence, hp: stats.baseHP, tempo: stats.tempo, moveBonus: stats.moveBonus } });
    }
  }
  return rows;
}
export async function captureProbe(root, game, { ref = 'HEAD', seeds } = {}) {
  gameId(game);
  ensure(typeof ref === 'string' && /^[A-Za-z0-9][A-Za-z0-9_./-]*$/.test(ref), 'invalid git ref');
  const fixturesText = readFileSync(resolve(root, '.autonomous/fixtures.json'), 'utf8'), fixtures = JSON.parse(fixturesText);
  seeds = seeds ?? fixtures.seeds;
  ensure(Array.isArray(seeds) && seeds.length > 0 && seeds.length <= 16 && new Set(seeds).size === seeds.length && seeds.every(s => Number.isSafeInteger(s) && s >= 0 && s <= 0xffffffff), 'use 1..16 unique uint32 fixture seeds');
  const revision = git(root, ['rev-parse', '--verify', `${ref}^{commit}`]), path = SOURCES[game];
  ensure(/^[0-9a-f]{40}$/.test(revision), 'exact source revision required');
  const source = git(root, ['show', `${revision}:${path}`]);
  // These initial adapters intentionally support only the two dependency-free modules.
  // Do not silently substitute stubs or a second implementation when dependencies appear.
  ensure(!/(?:^|\n)\s*import\s|\bimport\s*\(|\bexport\s[^;]*\bfrom\s|\b(?:fetch|document|window)\b/.test(source), 'module is no longer a portable leaf; adapt explicitly, never fake the game');
  const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const rows = game === 'village' ? villageProbe(api, seeds) : kuumetsuProbe(api, seeds);
  const harnessSource = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  return canonical({ schemaVersion: 1, game, kind: 'portable-state-probe',
    source: { revision, path, sha256: digest(source) },
    harness: { sha256: digest(harnessSource + '\n' + fixturesText), version: fixtures.version },
    conditions: { seeds, seedRole: 'synthetic-input-variation-not-game-rng', fixedStep: 'native-rule-call', fixtureVersion: fixtures.version },
    coverage: fixtures.coverage[game], notCovered: fixtures.notCovered[game], rows,
    execution: { node: process.version, hosted: process.env.GITHUB_ACTIONS === 'true', runId: process.env.GITHUB_RUN_ID ?? null, head: process.env.HEAD_SHA ?? null }
  });
}
function validateReport(report) {
  ensure(report?.schemaVersion === 1 && report.kind === 'portable-state-probe', 'unsupported report');
  gameId(report.game);
  ensure(/^[0-9a-f]{40}$/.test(report.source?.revision || '') && /^[0-9a-f]{64}$/.test(report.source?.sha256 || ''), 'report lacks source identity');
  ensure(/^[0-9a-f]{64}$/.test(report.harness?.sha256 || ''), 'report lacks harness identity');
  ensure(Array.isArray(report.rows) && report.rows.length > 0 && new Set(report.rows.map(row => row.id)).size === report.rows.length, 'empty/duplicate observations');
  for (const row of report.rows) {
    ensure(typeof row.id === 'string' && row.metrics && Object.keys(row.metrics).length > 0, 'empty observation');
    for (const value of Object.values(row.metrics)) ensure(['number', 'boolean', 'string'].includes(typeof value), 'metric must be scalar');
  }
  stable(report);
}
export function compareReports(before, after) {
  validateReport(before); validateReport(after);
  ensure(before.game === after.game && before.source.path === after.source.path && before.harness.sha256 === after.harness.sha256 && stable(before.conditions) === stable(after.conditions), 'incomparable game, harness or conditions; rerun BOTH sides with the same final harness');
  const afterRows = new Map(after.rows.map(row => [row.id, row]));
  ensure(before.rows.length === after.rows.length, 'scenario count changed');
  const differences = [];
  for (const row of before.rows) {
    const next = afterRows.get(row.id);
    ensure(next && stable(Object.keys(row.metrics).sort()) === stable(Object.keys(next.metrics).sort()), 'metric/scenario set changed');
    for (const key of Object.keys(row.metrics)) {
      const a = row.metrics[key], b = next.metrics[key];
      ensure(typeof a === typeof b, 'metric type changed');
      if (a !== b) differences.push({ scenario: row.id, metric: key, before: a, after: b, ...(typeof a === 'number' ? { delta: b - a } : {}) });
    }
  }
  return { schemaVersion: 1, game: before.game, before: before.source, after: after.source,
    harness: after.harness, conditions: after.conditions, comparable: true, changed: differences.length > 0, differences,
    limitation: 'Differences are not an improvement verdict. Evaluate the predeclared hypothesis; no claims about fun, feel, visuals or full combat.' };
}
