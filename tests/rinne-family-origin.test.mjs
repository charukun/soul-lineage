import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {FAMILY_CULTURES, FAMILY_ETHOS, FAMILY_TRADITIONS, FAMILY_QUESTIONS, createFamily, validateFamily, familyForLife, inheritFamily, describeFamily, createFamilyJourney} from '../apps/rinne/src/rebuild/family-origin.js';
import {createLife, serializeLife, deserializeLife, rebirth, applyEquipmentStation, YEAR_SECONDS, WEAPONS} from '../apps/rinne/src/rebuild/domain.js';
import {familyHomeArt, familyCrestArt, familyMemoryArt} from '../apps/rinne/src/family-origin-art.js';

const answers = {cultureId:'wa', ethosId:'discern', traditionId:'katana'};
const family = () => createFamily(answers, 'family-test');
const complete = journey => { assert.equal(journey.choose('wa'), true); assert.equal(journey.choose('discern'), true); assert.equal(journey.choose('katana'), true); return journey; };

test('all 27 authored origins round-trip with a supported but non-exclusive weapon', () => {
  let combinations = 0;
  for (const culture of FAMILY_CULTURES) for (const ethos of FAMILY_ETHOS) for (const tradition of FAMILY_TRADITIONS) {
    const origin = createFamily({cultureId:culture.id, ethosId:ethos.id, traditionId:tradition.id}, `family-${++combinations}`);
    const saved = deserializeLife(serializeLife(createLife({seed:11, family:origin})));
    assert.deepEqual(saved.family, origin);
    const description = describeFamily(saved.family);
    assert.ok(WEAPONS[description.weapon]); assert.ok(description.memory); assert.ok(description.practice);
    assert.equal(saved.equipment.weapon, 'fist'); assert.equal(saved.ageYears, 0);
  }
  assert.equal(combinations, 27);
});

test('the Japanese katana family has an authored house, crest, teaching and heirloom', () => {
  const description = describeFamily(family());
  assert.equal(description.name, '霧山の一族'); assert.equal(description.tradition, '刀の家伝');
  assert.equal(description.weapon, 'sword'); assert.equal(description.heirloom, '月影の刀');
  for (const culture of FAMILY_CULTURES) {
    assert.match(familyHomeArt(culture.id), /<svg/); assert.match(familyCrestArt(culture.id), /<svg/);
  }
  for (const question of FAMILY_QUESTIONS) for (const choice of question.choices) {
    assert.match(familyMemoryArt(choice.id), /<svg/);
    assert.doesNotMatch(familyMemoryArt(choice.id), /(?:href|src)=|<script/);
  }
});

test('canonical validation rejects fabricated choices, unsafe identity and malformed history', () => {
  for (const value of ['__proto__', 'constructor', '', 'unknown', null]) {
    assert.throws(() => createFamily({...answers, cultureId:value}, 'family-test'));
    assert.throws(() => createFamily({...answers, ethosId:value}, 'family-test'));
    assert.throws(() => createFamily({...answers, traditionId:value}, 'family-test'));
  }
  for (const patch of [{id:'<script>'}, {schemaVersion:99}, {origin:'guessed'}, {contributions:{}}, {archivedGenerations:-1}, {archivedGenerations:Infinity}]) assert.throws(() => validateFamily({...family(), ...patch}));
  assert.throws(() => validateFamily({...family(), contributions:[{lifeId:'life-1', generation:1, name:'a', returns:0, defeats:0, skills:Array(9).fill('skill.step')}]}));
  assert.equal(validateFamily({...family(), attackBonus:999}).attackBonus, undefined);
});

test('saving and continuing preserve the same life, age, choices and equipment', () => {
  const state = createLife({name:'旅の子', seed:23, family:family()});
  state.ageSeconds = 22 * YEAR_SECONDS; state.ageYears = 22; state.phase = 'living'; state.position = {x:4,z:-2};
  state.returns = 2; state.homelands = [state.birthVillageId];
  applyEquipmentStation(state, {id:'axe',label:'斧',equipment:{weapon:'axe'}});
  const resumed = deserializeLife(serializeLife(state));
  assert.equal(resumed.id, state.id); assert.equal(resumed.generation, state.generation);
  assert.equal(resumed.ageYears, 22); assert.deepEqual(resumed.position, state.position);
  assert.deepEqual(resumed.equipment, state.equipment); assert.deepEqual(resumed.knownSkills, state.knownSkills);
  assert.deepEqual(resumed.family, state.family); assert.deepEqual(resumed.homelands, state.homelands);
  resumed.family.contributions.push({lifeId:'different'}); assert.equal(state.family.contributions.length, 0);
});

test('old v2 saves migrate neutrally without forcing questions or changing progress', () => {
  const old = createLife({seed:81}); delete old.family;
  old.ageSeconds = 19 * YEAR_SECONDS; old.ageYears = 19; old.phase = 'living';
  old.generation = 2; old.lineage = [{lifeId:'life-ancestor', generation:1, name:'祖先', skills:['basic.fist'], experiences:{}}];
  const snapshot = structuredClone(old), migrated = deserializeLife(JSON.stringify(old));
  assert.equal(migrated.family.origin, 'legacy'); assert.equal(migrated.family.cultureId, 'wanderer');
  assert.equal(migrated.family.traditionId, 'none'); assert.equal(migrated.id, old.id); assert.equal(migrated.ageYears, 19);
  assert.deepEqual(migrated.equipment, old.equipment); assert.deepEqual(migrated.lineage, old.lineage);
  assert.deepEqual(old, snapshot); assert.equal(familyForLife(old).id, migrated.family.id);
  assert.deepEqual(deserializeLife(serializeLife(migrated)).family, migrated.family);
});

test('malformed chosen family is rejected, not silently reassigned or overwritten', () => {
  const life = createLife({family:family()}); life.family.traditionId = 'broken';
  assert.throws(() => deserializeLife(JSON.stringify(life)), /一族/);
});

test('rebirth keeps one family, records contributions, and still starts at age zero with basic gear', () => {
  const first = createLife({seed:10, family:family()}); first.ageYears = 100; first.ageSeconds = 6000; first.ended = true;
  first.returns = 3; first.defeats = 9; first.equipment.weapon = 'sword'; first.knownSkills.push('basic.sword');
  const second = rebirth(first);
  assert.equal(second.family.id, first.family.id); assert.equal(second.family.cultureId, 'wa'); assert.equal(second.family.traditionId, 'katana');
  assert.equal(second.generation, 2); assert.equal(second.ageYears, 0); assert.equal(second.equipment.weapon, 'fist');
  assert.equal(second.family.contributions[0].lifeId, first.id); assert.equal(second.family.contributions[0].returns, 3);
  assert.equal(second.family.contributions[0].defeats, 9); assert.equal(second.lineage[0].familyId, first.family.id);
  assert.equal(first.family.contributions.length, 0);
  assert.deepEqual(deserializeLife(serializeLife(second)).family, second.family);
});

test('family contribution recording is idempotent and bounded across long histories', () => {
  let origin = family();
  for (let generation = 1; generation <= 70; generation++) {
    const state = {id:`life-${generation}`, generation, name:'旅人', returns:1, defeats:2, knownSkills:['basic.fist','skill.step'], family:origin};
    origin = inheritFamily(state);
    assert.deepEqual(inheritFamily({...state, family:origin}), origin);
  }
  assert.equal(origin.id, 'family-test'); assert.equal(origin.contributions.length, 32); assert.equal(origin.archivedGenerations, 38);
  assert.equal(origin.contributions[0].generation, 39); assert.deepEqual(origin.contributions[31].skills, ['skill.step']);
  const corrupted = structuredClone(origin); corrupted.contributions[1].lifeId = corrupted.contributions[0].lifeId;
  assert.throws(() => validateFamily(corrupted));
});

test('family tradition never bypasses age seven or locks the player to its weapon', () => {
  const state = createLife({family:family()}); state.phase = 'living';
  const station = {id:'rack',label:'槍',equipment:{weapon:'spear'}};
  state.ageYears = 6.99; assert.equal(applyEquipmentStation(state, station), null); assert.equal(state.equipment.weapon, 'fist');
  state.ageYears = 7; assert.ok(applyEquipmentStation(state, station)); assert.equal(state.equipment.weapon, 'spear');
  assert.equal(state.family.traditionId, 'katana');
});

test('questions require three valid answers and preview is reversible', () => {
  const journey = createFamilyJourney();
  assert.equal(journey.confirm('family-test'), null); assert.equal(journey.back(), false); assert.equal(journey.choose('katana'), false);
  complete(journey); assert.equal(journey.choose('staff'), false); assert.equal(journey.back(), true);
  assert.equal(journey.choose('staff'), true);
  const origin = journey.confirm('family-test'); assert.equal(origin.traditionId, 'staff');
  assert.equal(journey.confirm('family-other'), null); assert.equal(journey.back(), false); assert.equal(journey.cancel(), false);
});

test('cancellation at any question or preview discards only the draft', () => {
  for (let stop = 0; stop <= 3; stop++) {
    const saved = serializeLife(createLife({family:family()})), journey = createFamilyJourney();
    for (let i = 0; i < stop; i++) journey.choose(['wa','discern','katana'][i]);
    assert.equal(journey.cancel(), true); assert.equal(journey.confirm('new-family'), null);
    assert.equal(journey.choose('wa'), false); assert.equal(deserializeLife(saved).family.id, 'family-test');
    assert.equal(createFamilyJourney().snapshot().step, 0);
  }
});

test('replacement requires explicit acknowledgement; snapshots cannot mutate the draft', () => {
  const journey = complete(createFamilyJourney()); journey.snapshot().answers.cultureId = 'forest';
  assert.equal(journey.confirm('family-new', {hasSave:true}), null);
  assert.equal(journey.snapshot().status, 'choosing');
  assert.equal(journey.confirm('family-new', {hasSave:true, replaceAcknowledged:true}).cultureId, 'wa');
});

test('runtime integration keeps Continue strict and commits a confirmed family before the first frame', () => {
  const runtime = readFileSync(new URL('../apps/rinne/src/rebuild/runtime.js', import.meta.url), 'utf8');
  const main = readFileSync(new URL('../apps/rinne/src/main.js', import.meta.url), 'utf8');
  assert.match(runtime, /if\(!raw\)throw Error\('続きから遊べる保存データがありません'\)/);
  assert.match(runtime, /current\|\|null\)!==expectedSave/);
  assert.match(runtime, /villageIds:\[layout\.id\],family/);
  assert.ok(runtime.indexOf("if(!coop&&mode==='new')await platform.storage.write") < runtime.indexOf('let active=true'));
  assert.match(main, /await openFamilyOrigin/); assert.match(main, /family:origin\.family/);
  assert.doesNotMatch(main, /renderFamilyTitle/); assert.match(main, /enterRinneLineageAudio/); assert.match(main, /exitRinneLineageAudio/);
});
